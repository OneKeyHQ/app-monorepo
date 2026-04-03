#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  1k-worktree-clean.sh list
  1k-worktree-clean.sh check <selection>
  1k-worktree-clean.sh cleanup-candidates <selection>

Examples:
  1k-worktree-clean.sh list
  1k-worktree-clean.sh check 1
  1k-worktree-clean.sh check 1,3
  1k-worktree-clean.sh check A
  1k-worktree-clean.sh cleanup-candidates 2,4
EOF
}

die() {
  echo "ERROR: $*" >&2
  exit 1
}

command="${1:-}"
selection="${2:-}"
repo_root="${REPO_ROOT:-$(git rev-parse --show-toplevel 2>/dev/null || true)}"

[[ -n "$repo_root" ]] || die "Run inside a git worktree or set REPO_ROOT."

common_git_dir="$(git -C "$repo_root" rev-parse --path-format=absolute --git-common-dir 2>/dev/null || true)"
[[ -n "$common_git_dir" ]] || die "Failed to locate git common dir."
main_repo_root="$(dirname "$common_git_dir")"
shared_worktree_root="${main_repo_root}/.worktree"

declare -a WT_PATHS=()
declare -a WT_BRANCHES=()
declare -a WT_NAMES=()
declare -a WT_DIRTY=()
declare -a WT_UPSTREAMS=()
declare -a WT_LAST_COMMIT_SHAS=()
declare -a WT_LAST_COMMIT_TIMES=()
declare -a WT_LAST_COMMIT_SUBJECTS=()
declare -a WT_NESTED_FLAGS=()
declare -a WT_NESTED_PARENT_NAMES=()
declare -a WT_NESTED_PARENT_PATHS=()
declare -a WT_PR_LABELS=()
declare -a WT_PR_URLS=()
declare -a PR_CACHE_BRANCHES=()
declare -a PR_CACHE_LABELS=()
declare -a PR_CACHE_URLS=()
GH_PR_LOOKUP_STATE="unknown"
GH_PR_LOOKUP_REASON=""
LAST_SUMMARY_LINE=""
DETAIL_OUTPUT=""
LAST_RESULT=""
LAST_WORKTREE_PATH=""
LAST_WORKTREE_NAME=""
LAST_WORKTREE_BRANCH=""
LAST_WORKTREE_DIRTY=""
LAST_WORKTREE_UPSTREAM=""
LAST_WORKTREE_LAST_COMMIT_SHA=""
LAST_WORKTREE_LAST_COMMIT_TIME=""
LAST_WORKTREE_LAST_COMMIT_SUBJECT=""
LAST_WORKTREE_NESTED_FLAG=""
LAST_WORKTREE_NESTED_PARENT_NAME=""
LAST_WORKTREE_NESTED_PARENT_PATH=""
LAST_WORKTREE_PR_LABEL=""
LAST_WORKTREE_PR_URL=""
LAST_CANDIDATE_COUNT=0
LAST_UNMATCHED_COUNT=0

append_worktree() {
  local path="$1"
  local branch="$2"
  local head="$3"
  local dirty="clean"

  if [[ -n "$(git -C "$path" status --short --untracked-files=all 2>/dev/null)" ]]; then
    dirty="dirty"
  fi

  WT_PATHS+=("$path")
  if [[ -n "$branch" ]]; then
    WT_BRANCHES+=("$branch")
  else
    WT_BRANCHES+=("(detached ${head:0:7})")
  fi
  WT_NAMES+=("$(basename "$path")")
  WT_DIRTY+=("$dirty")
}

load_worktrees() {
  local line=""
  local cur_path=""
  local cur_branch=""
  local cur_head=""

  while IFS= read -r line; do
    if [[ -z "$line" ]]; then
      if [[ -n "$cur_path" ]]; then
        append_worktree "$cur_path" "$cur_branch" "$cur_head"
      fi
      cur_path=""
      cur_branch=""
      cur_head=""
      continue
    fi

    case "$line" in
      "worktree "*)
        cur_path="${line#worktree }"
        ;;
      "branch refs/heads/"*)
        cur_branch="${line#branch refs/heads/}"
        ;;
      "branch "*)
        cur_branch="${line#branch }"
        ;;
      "HEAD "*)
        cur_head="${line#HEAD }"
        ;;
      "detached")
        cur_branch=""
        ;;
    esac
  done < <(git -C "$repo_root" worktree list --porcelain; printf '\n')
}

contains_value() {
  local needle="$1"
  shift
  local item=""

  for item in "$@"; do
    if [[ "$item" == "$needle" ]]; then
      return 0
    fi
  done

  return 1
}

dedupe_and_print() {
  local item=""
  local -a seen=()

  for item in "$@"; do
    [[ -n "$item" ]] || continue
    if (( ${#seen[@]} == 0 )) || ! contains_value "$item" "${seen[@]}"; then
      seen+=("$item")
      printf '%s\n' "$item"
    fi
  done
}

list_worktrees() {
  local i=0
  local nested_display=""

  echo "检测到以下本地 worktree："
  for ((i = 0; i < ${#WT_PATHS[@]}; i += 1)); do
    if [[ "${WT_NESTED_FLAGS[$i]}" == "yes" ]]; then
      nested_display="yes | parent: ${WT_NESTED_PARENT_NAMES[$i]}"
    else
      nested_display="no"
    fi

    printf '%d. %s | branch: %s | %s | %s\n' \
      "$((i + 1))" \
      "${WT_NAMES[$i]}" \
      "${WT_BRANCHES[$i]}" \
      "${WT_DIRTY[$i]}" \
      "${WT_PATHS[$i]}"
    printf '   upstream: %s | last commit: %s %s | pr: %s | nested: %s\n' \
      "${WT_UPSTREAMS[$i]}" \
      "${WT_LAST_COMMIT_SHAS[$i]}" \
      "${WT_LAST_COMMIT_TIMES[$i]}" \
      "${WT_PR_LABELS[$i]}" \
      "$nested_display"
  done
  echo "A. 全部"
}

parse_selection() {
  local raw="$1"
  local normalized=""
  local token=""
  local idx=0
  local -a tokens=()
  local -a selected=()

  normalized="$(printf '%s' "$raw" | tr '[:lower:]' '[:upper:]' | tr -d '[:space:]')"
  [[ -n "$normalized" ]] || die "Selection is required."

  if [[ "$normalized" == "A" ]]; then
    for ((idx = 0; idx < ${#WT_PATHS[@]}; idx += 1)); do
      selected+=("$idx")
    done
  else
    IFS=',' read -r -a tokens <<< "$normalized"
    for token in "${tokens[@]}"; do
      [[ "$token" =~ ^[0-9]+$ ]] || die "Invalid selection: $raw"
      idx=$((token - 1))
      ((idx >= 0 && idx < ${#WT_PATHS[@]})) || die "Selection out of range: $token"
      if (( ${#selected[@]} == 0 )) || ! contains_value "$idx" "${selected[@]}"; then
        selected+=("$idx")
      fi
    done
  fi

  printf '%s\n' "${selected[@]}"
}

blob_or_absent() {
  local wt="$1"
  local rev="$2"
  local rel_path="$3"

  if git -C "$wt" cat-file -e "$rev:$rel_path" 2>/dev/null; then
    git -C "$wt" rev-parse "$rev:$rel_path"
  else
    printf '__ABSENT__\n'
  fi
}

collect_candidate_paths() {
  local wt="$1"
  local status=""
  local path_a=""
  local path_b=""
  local -a paths=()

  while IFS=$'\t' read -r status path_a path_b; do
    [[ -n "$status" ]] || continue
    case "$status" in
      R*|C*)
        paths+=("$path_a" "$path_b")
        ;;
      *)
        paths+=("$path_a")
        ;;
    esac
  done < <(git -C "$wt" diff --name-status --find-renames origin/x...HEAD --)

  if (( ${#paths[@]} > 0 )); then
    dedupe_and_print "${paths[@]}"
  fi
}

list_stale_dirs() {
  local dir=""
  local -a stale_dirs=()

  [[ -d "$shared_worktree_root" ]] || return 0

  while IFS= read -r dir; do
    [[ -n "$dir" ]] || continue
    if ! contains_value "$dir" "${WT_PATHS[@]}"; then
      stale_dirs+=("$dir")
    fi
  done < <(find "$shared_worktree_root" -mindepth 1 -maxdepth 1 -type d | sort)

  if (( ${#stale_dirs[@]} > 0 )); then
    dedupe_and_print "${stale_dirs[@]}"
  fi
}

collect_dirty_files() {
  local wt="$1"
  git -C "$wt" status --short --untracked-files=all
}

resolve_upstream() {
  local wt="$1"
  local branch="$2"
  local upstream=""

  if [[ "$branch" == "(detached "* ]]; then
    printf '(none)\n'
    return 0
  fi

  upstream="$(git -C "$wt" for-each-ref --format='%(upstream:short)' "refs/heads/$branch" | head -n 1)"
  if [[ -n "$upstream" ]]; then
    printf '%s\n' "$upstream"
  else
    printf '(none)\n'
  fi
}

resolve_last_commit_metadata() {
  local wt="$1"
  git -C "$wt" log -1 --date=format-local:'%Y-%m-%d %H:%M:%S %z' \
    --format='%h%x1f%cd%x1f%s' HEAD 2>/dev/null || true
}

resolve_nested_parent() {
  local wt="$1"
  local i=0
  local candidate_path=""
  local selected_parent_name=""
  local selected_parent_path=""

  for ((i = 0; i < ${#WT_PATHS[@]}; i += 1)); do
    candidate_path="${WT_PATHS[$i]}"
    [[ "$candidate_path" == "$wt" ]] && continue
    [[ "$candidate_path" == "$main_repo_root" ]] && continue

    if [[ "$wt" == "$candidate_path"/* ]]; then
      if [[ -z "$selected_parent_path" ]] || (( ${#candidate_path} > ${#selected_parent_path} )); then
        selected_parent_name="${WT_NAMES[$i]}"
        selected_parent_path="$candidate_path"
      fi
    fi
  done

  printf '%s\x1f%s\n' "$selected_parent_name" "$selected_parent_path"
}

find_pr_cache_index() {
  local branch="$1"
  local i=0

  for ((i = 0; i < ${#PR_CACHE_BRANCHES[@]}; i += 1)); do
    if [[ "${PR_CACHE_BRANCHES[$i]}" == "$branch" ]]; then
      printf '%d\n' "$i"
      return 0
    fi
  done

  printf '%d\n' '-1'
}

mark_pr_lookup_unavailable() {
  local reason="$1"
  GH_PR_LOOKUP_STATE="unavailable"
  GH_PR_LOOKUP_REASON="$reason"
}

ensure_pr_lookup_ready() {
  if [[ "$GH_PR_LOOKUP_STATE" == "available" ]]; then
    return 0
  fi

  if [[ "$GH_PR_LOOKUP_STATE" == "unavailable" ]]; then
    return 1
  fi

  if ! command -v gh >/dev/null 2>&1; then
    mark_pr_lookup_unavailable "gh-missing"
    return 1
  fi

  if ! gh auth status >/dev/null 2>&1; then
    mark_pr_lookup_unavailable "gh-auth-unavailable"
    return 1
  fi

  GH_PR_LOOKUP_STATE="available"
  return 0
}

resolve_pr_metadata() {
  local branch="$1"
  local cache_idx=""
  local line=""
  local number=""
  local state=""
  local is_draft=""
  local merged_at=""
  local url=""
  local label=""

  if [[ "$branch" == "(detached "* ]]; then
    printf 'DETACHED\x1f\n'
    return 0
  fi

  if [[ "$branch" == "x" ]]; then
    printf 'N/A\x1f\n'
    return 0
  fi

  cache_idx="$(find_pr_cache_index "$branch")"
  if [[ "$cache_idx" != "-1" ]]; then
    printf '%s\x1f%s\n' "${PR_CACHE_LABELS[$cache_idx]}" "${PR_CACHE_URLS[$cache_idx]}"
    return 0
  fi

  if ! ensure_pr_lookup_ready; then
    printf 'UNAVAILABLE (%s)\x1f\n' "$GH_PR_LOOKUP_REASON"
    return 0
  fi

  if ! line="$(
    cd "$main_repo_root" &&
      gh pr list --head "$branch" --state all --limit 1 \
        --json number,state,isDraft,mergedAt,url \
        --jq 'if length == 0 then "NONE" else .[0] | "\(.number)\u001f\(.state)\u001f\(.isDraft)\u001f\(.mergedAt // "")\u001f\(.url)" end'
  )"; then
    mark_pr_lookup_unavailable "gh-query-failed"
    printf 'UNAVAILABLE (%s)\x1f\n' "$GH_PR_LOOKUP_REASON"
    return 0
  fi

  if [[ "$line" == "NONE" ]]; then
    label="NONE"
    url=""
  else
    IFS=$'\x1f' read -r number state is_draft merged_at url <<< "$line"
    if [[ -n "$merged_at" ]]; then
      label="MERGED #${number}"
    elif [[ "$state" == "OPEN" && "$is_draft" == "true" ]]; then
      label="OPEN DRAFT #${number}"
    elif [[ "$state" == "OPEN" ]]; then
      label="OPEN #${number}"
    elif [[ "$state" == "CLOSED" ]]; then
      label="CLOSED #${number}"
    else
      label="${state:-UNKNOWN} #${number}"
    fi
  fi

  PR_CACHE_BRANCHES+=("$branch")
  PR_CACHE_LABELS+=("$label")
  PR_CACHE_URLS+=("$url")
  printf '%s\x1f%s\n' "$label" "$url"
}

hydrate_worktree_metadata() {
  local i=0
  local wt=""
  local branch=""
  local upstream=""
  local commit_meta=""
  local last_sha=""
  local last_time=""
  local last_subject=""
  local nested_meta=""
  local nested_parent_name=""
  local nested_parent_path=""
  local pr_meta=""
  local pr_label=""
  local pr_url=""

  for ((i = 0; i < ${#WT_PATHS[@]}; i += 1)); do
    wt="${WT_PATHS[$i]}"
    branch="${WT_BRANCHES[$i]}"

    upstream="$(resolve_upstream "$wt" "$branch")"
    WT_UPSTREAMS+=("$upstream")

    commit_meta="$(resolve_last_commit_metadata "$wt")"
    IFS=$'\x1f' read -r last_sha last_time last_subject <<< "$commit_meta"
    WT_LAST_COMMIT_SHAS+=("${last_sha:-unknown}")
    WT_LAST_COMMIT_TIMES+=("${last_time:-unknown}")
    WT_LAST_COMMIT_SUBJECTS+=("${last_subject:-unknown}")

    nested_meta="$(resolve_nested_parent "$wt")"
    IFS=$'\x1f' read -r nested_parent_name nested_parent_path <<< "$nested_meta"
    if [[ -n "$nested_parent_path" ]]; then
      WT_NESTED_FLAGS+=("yes")
      WT_NESTED_PARENT_NAMES+=("$nested_parent_name")
      WT_NESTED_PARENT_PATHS+=("$nested_parent_path")
    else
      WT_NESTED_FLAGS+=("no")
      WT_NESTED_PARENT_NAMES+=("")
      WT_NESTED_PARENT_PATHS+=("")
    fi

    pr_meta="$(resolve_pr_metadata "$branch")"
    IFS=$'\x1f' read -r pr_label pr_url <<< "$pr_meta"
    WT_PR_LABELS+=("${pr_label:-UNKNOWN}")
    WT_PR_URLS+=("$pr_url")
  done
}

removal_blocker_for_worktree() {
  local wt="$1"
  local dirty="$2"

  if [[ "$wt" == "$main_repo_root" ]]; then
    printf 'main worktree\n'
  elif [[ "$wt" == "$repo_root" ]]; then
    printf 'current worktree\n'
  elif [[ "$dirty" != "clean" ]]; then
    printf 'dirty working tree\n'
  fi
}

check_one_worktree() {
  local idx="$1"
  local wt="${WT_PATHS[$idx]}"
  local name="${WT_NAMES[$idx]}"
  local branch="${WT_BRANCHES[$idx]}"
  local dirty="${WT_DIRTY[$idx]}"
  local candidate_output=""
  local dirty_output=""
  local rel_path=""
  local head_blob=""
  local x_blob=""
  local result=""
  local candidate_count=0
  local matched_count=0
  local unmatched_count=0
  local matched_lines=""
  local unmatched_lines=""

  git -C "$wt" rev-parse --verify origin/x^{commit} >/dev/null 2>&1 || \
    die "origin/x is missing for $wt. Fetch origin x before running check."

  candidate_output="$(collect_candidate_paths "$wt")"
  dirty_output="$(collect_dirty_files "$wt" || true)"

  while IFS= read -r rel_path; do
    [[ -n "$rel_path" ]] || continue
    candidate_count=$((candidate_count + 1))
    head_blob="$(blob_or_absent "$wt" HEAD "$rel_path")"
    x_blob="$(blob_or_absent "$wt" origin/x "$rel_path")"
    if [[ "$head_blob" == "$x_blob" ]]; then
      matched_count=$((matched_count + 1))
      matched_lines="${matched_lines}- ${rel_path}"$'\n'
    else
      unmatched_count=$((unmatched_count + 1))
      unmatched_lines="${unmatched_lines}- ${rel_path}"$'\n'
    fi
  done <<< "$candidate_output"

  if [[ $candidate_count -eq 0 ]]; then
    result="NO_BRANCH_CODE_DELTA_FROM_COMMON_BASE"
  elif [[ $unmatched_count -eq 0 ]]; then
    result="MERGED_TO_ORIGIN_X_BY_CODE"
  else
    result="NOT_FULLY_MERGED_TO_ORIGIN_X_BY_CODE"
  fi

  DETAIL_OUTPUT=""
  DETAIL_OUTPUT="${DETAIL_OUTPUT}=== [$((idx + 1))] ${name} ==="$'\n'
  DETAIL_OUTPUT="${DETAIL_OUTPUT}Path: ${wt}"$'\n'
  DETAIL_OUTPUT="${DETAIL_OUTPUT}Branch: ${branch}"$'\n'
  DETAIL_OUTPUT="${DETAIL_OUTPUT}Working tree: ${dirty}"$'\n'
  DETAIL_OUTPUT="${DETAIL_OUTPUT}Upstream: ${WT_UPSTREAMS[$idx]}"$'\n'
  DETAIL_OUTPUT="${DETAIL_OUTPUT}Last commit: ${WT_LAST_COMMIT_SHAS[$idx]} | ${WT_LAST_COMMIT_TIMES[$idx]} | ${WT_LAST_COMMIT_SUBJECTS[$idx]}"$'\n'
  DETAIL_OUTPUT="${DETAIL_OUTPUT}PR: ${WT_PR_LABELS[$idx]}"$'\n'
  if [[ -n "${WT_PR_URLS[$idx]}" ]]; then
    DETAIL_OUTPUT="${DETAIL_OUTPUT}PR URL: ${WT_PR_URLS[$idx]}"$'\n'
  fi
  if [[ "${WT_NESTED_FLAGS[$idx]}" == "yes" ]]; then
    DETAIL_OUTPUT="${DETAIL_OUTPUT}Nested worktree: yes | parent: ${WT_NESTED_PARENT_NAMES[$idx]} | ${WT_NESTED_PARENT_PATHS[$idx]}"$'\n'
  else
    DETAIL_OUTPUT="${DETAIL_OUTPUT}Nested worktree: no"$'\n'
  fi
  DETAIL_OUTPUT="${DETAIL_OUTPUT}Branch-side candidate files: ${candidate_count}"$'\n'
  DETAIL_OUTPUT="${DETAIL_OUTPUT}Matched files: ${matched_count}"$'\n'
  DETAIL_OUTPUT="${DETAIL_OUTPUT}Unmatched files: ${unmatched_count}"$'\n'
  DETAIL_OUTPUT="${DETAIL_OUTPUT}Result: ${result}"$'\n'

  if [[ -n "$matched_lines" ]]; then
    DETAIL_OUTPUT="${DETAIL_OUTPUT}Matched file list:"$'\n'"${matched_lines}"
  fi

  if [[ -n "$unmatched_lines" ]]; then
    DETAIL_OUTPUT="${DETAIL_OUTPUT}Unmatched file list:"$'\n'"${unmatched_lines}"
  fi

  if [[ -n "$dirty_output" ]]; then
    DETAIL_OUTPUT="${DETAIL_OUTPUT}Dirty files:"$'\n'"${dirty_output}"$'\n'
    DETAIL_OUTPUT="${DETAIL_OUTPUT}Note: committed branch result above does not cover uncommitted local edits."$'\n'
  fi

  DETAIL_OUTPUT="${DETAIL_OUTPUT}"$'\n'
  LAST_SUMMARY_LINE="$(printf 'SUMMARY|%d|%s|%s|%s|%d|%d' \
    "$((idx + 1))" \
    "$name" \
    "$result" \
    "$dirty" \
    "$candidate_count" \
    "$unmatched_count")"
  LAST_RESULT="$result"
  LAST_WORKTREE_PATH="$wt"
  LAST_WORKTREE_NAME="$name"
  LAST_WORKTREE_BRANCH="$branch"
  LAST_WORKTREE_DIRTY="$dirty"
  LAST_WORKTREE_UPSTREAM="${WT_UPSTREAMS[$idx]}"
  LAST_WORKTREE_LAST_COMMIT_SHA="${WT_LAST_COMMIT_SHAS[$idx]}"
  LAST_WORKTREE_LAST_COMMIT_TIME="${WT_LAST_COMMIT_TIMES[$idx]}"
  LAST_WORKTREE_LAST_COMMIT_SUBJECT="${WT_LAST_COMMIT_SUBJECTS[$idx]}"
  LAST_WORKTREE_NESTED_FLAG="${WT_NESTED_FLAGS[$idx]}"
  LAST_WORKTREE_NESTED_PARENT_NAME="${WT_NESTED_PARENT_NAMES[$idx]}"
  LAST_WORKTREE_NESTED_PARENT_PATH="${WT_NESTED_PARENT_PATHS[$idx]}"
  LAST_WORKTREE_PR_LABEL="${WT_PR_LABELS[$idx]}"
  LAST_WORKTREE_PR_URL="${WT_PR_URLS[$idx]}"
  LAST_CANDIDATE_COUNT="$candidate_count"
  LAST_UNMATCHED_COUNT="$unmatched_count"
}

run_check() {
  local idx=""
  local summary_lines=""

  while IFS= read -r idx; do
    [[ -n "$idx" ]] || continue
    check_one_worktree "$idx"
    printf '%s' "$DETAIL_OUTPUT"
    summary_lines="${summary_lines}${LAST_SUMMARY_LINE}"$'\n'
  done < <(parse_selection "$selection")

  echo "=== SUMMARY ==="
  printf '%s' "$summary_lines"
}

run_cleanup_candidates() {
  local idx=""
  local stale_dir_output=""
  local stale_dir=""
  local stale_count=0
  local removable_count=0
  local skipped_count=0
  local blocker=""
  local reason=""
  local removable_lines=""
  local skipped_lines=""
  local summary_lines=""
  local nested_display=""

  stale_dir_output="$(list_stale_dirs || true)"
  while IFS= read -r stale_dir; do
    [[ -n "$stale_dir" ]] || continue
    stale_count=$((stale_count + 1))
  done <<< "$stale_dir_output"

  while IFS= read -r idx; do
    [[ -n "$idx" ]] || continue
    check_one_worktree "$idx"

    if [[ "$LAST_RESULT" == "MERGED_TO_ORIGIN_X_BY_CODE" ]]; then
      reason="merged-by-code"
    elif [[ "$LAST_RESULT" == "NO_BRANCH_CODE_DELTA_FROM_COMMON_BASE" ]]; then
      reason="no-branch-delta"
    else
      continue
    fi

    blocker="$(removal_blocker_for_worktree "$LAST_WORKTREE_PATH" "$LAST_WORKTREE_DIRTY")"
    if [[ "$LAST_WORKTREE_NESTED_FLAG" == "yes" ]]; then
      nested_display="yes | parent: ${LAST_WORKTREE_NESTED_PARENT_NAME}"
    else
      nested_display="no"
    fi

    if [[ -z "$blocker" ]]; then
      removable_count=$((removable_count + 1))
      removable_lines="${removable_lines}- [$((idx + 1))] ${LAST_WORKTREE_NAME} | branch: ${LAST_WORKTREE_BRANCH} | upstream: ${LAST_WORKTREE_UPSTREAM} | last commit: ${LAST_WORKTREE_LAST_COMMIT_SHA} ${LAST_WORKTREE_LAST_COMMIT_TIME} | pr: ${LAST_WORKTREE_PR_LABEL} | nested: ${nested_display} | reason: ${LAST_RESULT} | ${LAST_WORKTREE_PATH}"$'\n'
      summary_lines="${summary_lines}REMOVABLE_WORKTREE|$((idx + 1))|${LAST_WORKTREE_NAME}|${LAST_WORKTREE_BRANCH}|${LAST_RESULT}|${reason}|${LAST_WORKTREE_PATH}"$'\n'
    else
      skipped_count=$((skipped_count + 1))
      skipped_lines="${skipped_lines}- [$((idx + 1))] ${LAST_WORKTREE_NAME} | branch: ${LAST_WORKTREE_BRANCH} | upstream: ${LAST_WORKTREE_UPSTREAM} | last commit: ${LAST_WORKTREE_LAST_COMMIT_SHA} ${LAST_WORKTREE_LAST_COMMIT_TIME} | pr: ${LAST_WORKTREE_PR_LABEL} | nested: ${nested_display} | reason: ${LAST_RESULT} | ${LAST_WORKTREE_PATH} | skipped: ${blocker}"$'\n'
    fi
  done < <(parse_selection "$selection")

  echo "=== CLEANUP CANDIDATES ==="
  echo "Stale worktree directories: ${stale_count}"
  if [[ -n "$stale_dir_output" ]]; then
    while IFS= read -r stale_dir; do
      [[ -n "$stale_dir" ]] || continue
      printf -- '- %s\n' "$stale_dir"
      summary_lines="${summary_lines}STALE_DIR|${stale_dir}"$'\n'
    done <<< "$stale_dir_output"
  fi

  echo "Removable worktrees: ${removable_count}"
  if [[ -n "$removable_lines" ]]; then
    printf '%s' "$removable_lines"
  fi

  echo "Skipped removable worktrees: ${skipped_count}"
  if [[ -n "$skipped_lines" ]]; then
    printf '%s' "$skipped_lines"
  fi

  echo "=== CLEANUP SUMMARY ==="
  printf '%s' "$summary_lines"
}

load_worktrees
(( ${#WT_PATHS[@]} > 0 )) || die "No git worktrees found."
hydrate_worktree_metadata

case "$command" in
  list)
    list_worktrees
    ;;
  check)
    [[ -n "$selection" ]] || die "check requires a selection such as 1, 1,3, or A."
    run_check
    ;;
  cleanup-candidates)
    [[ -n "$selection" ]] || die "cleanup-candidates requires a selection such as 1, 1,3, or A."
    run_cleanup_candidates
    ;;
  *)
    usage
    exit 1
    ;;
esac
