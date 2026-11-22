#include "theme.h"

#include <algorithm>
#include <array>
#include <cmath>
#include <cwchar>

namespace installer {
namespace {

#include "generated-theme.inc"

Gdiplus::ARGB ParseColor(std::wstring_view value, Gdiplus::ARGB fallback) {
  if ((value.size() != 7 && value.size() != 9) || value[0] != L'#') {
    return fallback;
  }
  wchar_t* end = nullptr;
  const unsigned long parsed = wcstoul(value.data() + 1, &end, 16);
  if (end != value.data() + value.size()) {
    return fallback;
  }
  return value.size() == 7 ? parsed | 0xFF000000UL : parsed;
}

bool Visible(const Node& node, const State& state) {
  if (node.Attribute(L"name") == L"advanced-options") {
    return state.advanced_options;
  }
  return node.Attribute(L"visible") != L"false";
}

bool Floating(const Node& node) {
  return node.Attribute(L"float") == L"0,0,1,1";
}

std::array<int, 4> Edges(std::wstring_view values) {
  std::array<int, 4> edges{};
  if (!values.empty()) {
    swscanf_s(values.data(), L"%d,%d,%d,%d", &edges[0], &edges[1], &edges[2], &edges[3]);
  }
  return edges;
}

void LayoutNode(const Node& node, Gdiplus::RectF bounds, const State& state,
                std::vector<Element>& elements) {
  elements.push_back({&node, bounds});
  const auto content = Inset(bounds, node.Attribute(L"inset"));
  if (node.kind == Kind::overlay) {
    for (const auto& child : node.children) {
      if (Visible(child, state)) {
        LayoutNode(child, content, state, elements);
      }
    }
    return;
  }
  if (node.children.empty()) {
    return;
  }
  const bool horizontal = node.kind == Kind::horizontal;
  const auto axis = horizontal ? L"width" : L"height";
  const auto cross_axis = horizontal ? L"height" : L"width";
  const float available = horizontal ? content.Width : content.Height;
  const float cross = horizontal ? content.Height : content.Width;
  float allocated = 0;
  int flexible = 0;
  for (const auto& child : node.children) {
    if (!Visible(child, state) || Floating(child)) {
      continue;
    }
    const int size = child.Number(axis);
    const auto padding = Edges(child.Attribute(L"padding"));
    allocated += static_cast<float>(size + padding[horizontal ? 0 : 1] + padding[horizontal ? 2 : 3]);
    flexible += size == 0;
  }
  const float free = std::max(0.0F, available - allocated);
  const float share = flexible == 0 ? 0 : std::floor(free / flexible);
  float position = 0;
  for (const auto& child : node.children) {
    if (!Visible(child, state)) {
      continue;
    }
    if (Floating(child)) {
      LayoutNode(child, content, state, elements);
      continue;
    }
    const auto padding = Edges(child.Attribute(L"padding"));
    const int leading = padding[horizontal ? 0 : 1];
    const int trailing = padding[horizontal ? 2 : 3];
    const int cross_leading = padding[horizontal ? 1 : 0];
    const int cross_trailing = padding[horizontal ? 3 : 2];
    allocated -= leading + trailing;
    float size = static_cast<float>(child.Number(axis));
    if (size == 0) {
      size = --flexible == 0 ? std::max(0.0F, available - position - leading - trailing - allocated) : share;
    } else {
      allocated -= size;
    }
    const float preferred_cross = static_cast<float>(child.Number(cross_axis));
    const float cross_space = std::max(0.0F, cross - cross_leading - cross_trailing);
    const float cross_size = preferred_cross > 0 ? std::min(preferred_cross, cross_space) : cross_space;
    const float cross_offset = horizontal && node.Attribute(L"childvalign") == L"vcenter"
                                   ? std::floor(cross / 2) - std::floor(cross_size / 2)
                                   : static_cast<float>(cross_leading);
    const Gdiplus::RectF child_bounds = horizontal
        ? Gdiplus::RectF(content.X + position + leading, content.Y + cross_offset, size, cross_size)
        : Gdiplus::RectF(content.X + cross_offset, content.Y + position + leading, cross_size, size);
    LayoutNode(child, child_bounds, state, elements);
    position += size + leading + trailing;
  }
}

std::wstring_view LocalizedFamily(std::wstring_view locale) {
  const auto language = locale.substr(0, locale.find(L'-'));
  if (language == L"zh") {
    return locale == L"zh-HK" || locale == L"zh-TW"
               ? L"Microsoft JhengHei UI"
               : L"Microsoft YaHei UI";
  }
  if (language == L"ja") return L"Yu Gothic UI";
  if (language == L"ko") return L"Malgun Gothic";
  if (language == L"th") return L"Leelawadee UI";
  if (language == L"hi" || language == L"bn") return L"Nirmala UI";
  return L"Segoe UI";
}

bool FontInstalled(std::wstring_view name) {
  const std::wstring terminated(name);
  const Gdiplus::FontFamily family(terminated.c_str());
  return family.GetLastStatus() == Gdiplus::Ok;
}

}  // namespace

std::wstring_view Node::Attribute(std::wstring_view key) const {
  const auto found = attributes.find(key);
  return found == attributes.end() ? std::wstring_view{} : found->second;
}

int Node::Number(std::wstring_view key) const {
  const auto value = Attribute(key);
  return value.empty() ? 0 : _wtoi(value.data());
}

Gdiplus::ARGB Node::Color(std::wstring_view key, Gdiplus::ARGB fallback) const {
  return ParseColor(Attribute(key), fallback);
}

const Geometry& WindowGeometry() { return geometry; }

const Page* FindPage(std::wstring_view name) {
  const auto found = pages.find(name);
  return found == pages.end() ? nullptr : &found->second;
}

std::wstring_view Text(std::wstring_view locale, std::wstring_view key) {
  const auto selected = locales.find(locale);
  if (selected != locales.end()) {
    const auto found = selected->second.find(key);
    if (found != selected->second.end()) {
      return found->second;
    }
  }
  const auto& english = locales.at(L"en-US");
  const auto found = english.find(key);
  return found == english.end() ? std::wstring_view{} : found->second;
}

Gdiplus::ARGB ThemeColor(std::wstring_view name) {
  const auto found = colors.find(name);
  return found == colors.end() ? 0 : ParseColor(found->second, 0);
}

std::wstring ElementText(const Node& node, const State& state, bool welcome) {
  const auto name = node.Attribute(L"name");
  if (name == L"status" && !state.status.empty()) {
    return state.status;
  }
  if (welcome && name == L"more-options") {
    return std::wstring(Text(state.locale, state.advanced_options
        ? L"welcome.lessOptions" : L"welcome.moreOptions"));
  }
  if (welcome && name == L"primary" && state.options_visited) {
    return std::wstring(Text(state.locale, L"welcome.install"));
  }

  std::wstring result;
  auto value = node.Attribute(L"text");
  auto start = value.find(L"{{");
  while (start != std::wstring_view::npos) {
    result.append(value.substr(0, start));
    const auto end = value.find(L"}}", start + 2);
    if (end == std::wstring_view::npos) {
      break;
    }
    const auto token = value.substr(start + 2, end - start - 2);
    if (token.substr(0, 7) == L"string.") {
      result.append(Text(state.locale, token.substr(7)));
    } else if (token == L"runtime.version") {
      result.append(state.version);
    } else if (token == L"runtime.progress") {
      result.append(std::to_wstring(state.progress));
    } else if (token == L"runtime.installDirectory") {
      result.append(state.install_directory);
    } else if (token == L"runtime.perUserInstallDirectory") {
      result.append(state.per_user_directory);
    } else if (token == L"runtime.perMachineInstallDirectory") {
      result.append(state.per_machine_directory);
    }
    value.remove_prefix(end + 2);
    start = value.find(L"{{");
  }
  result.append(value);
  return result;
}

LegalText ParseLegalText(std::wstring_view raw) {
  LegalText result;
  auto remainder = raw;
  for (std::size_t i = 0; i < kLegalLinks.size(); ++i) {
    const auto marker = L"{a " + std::wstring(kLegalLinks[i]) + L"}";
    const auto begin = remainder.find(marker);
    const auto end = begin == std::wstring_view::npos ? begin : remainder.find(L"{/a}", begin);
    if (end == std::wstring_view::npos) return {std::wstring(raw), {}};

    result.text.append(remainder.substr(0, begin));
    const auto label = begin + marker.size();
    result.links[i] = {result.text.size(), end - label};
    result.text.append(remainder.substr(label, result.links[i].length));
    remainder.remove_prefix(end + 4);
    if (!remainder.empty() && remainder.front() == L' ') remainder.remove_prefix(1);
  }
  result.text.append(remainder);
  return result;
}

std::wstring SelectFontFamily(std::wstring_view families, std::wstring_view locale) {
  if (families.substr(0, families.find(L',')) == L"Segoe UI") {
    const auto preferred = LocalizedFamily(locale);
    if (FontInstalled(preferred)) {
      return std::wstring(preferred);
    }
  }
  while (!families.empty()) {
    const auto separator = families.find(L',');
    auto family = families.substr(0, separator);
    const auto start = family.find_first_not_of(L" \t");
    if (start != std::wstring_view::npos) {
      const auto end = family.find_last_not_of(L" \t");
      family = family.substr(start, end - start + 1);
      if (FontInstalled(family)) {
        return std::wstring(family);
      }
    }
    if (separator == std::wstring_view::npos) {
      break;
    }
    families.remove_prefix(separator + 1);
  }
  return L"Segoe UI";
}

Gdiplus::RectF Inset(Gdiplus::RectF bounds, std::wstring_view values) {
  const auto edges = Edges(values);
  bounds.X += edges[0];
  bounds.Y += edges[1];
  bounds.Width = std::max(0.0F, bounds.Width - edges[0] - edges[2]);
  bounds.Height = std::max(0.0F, bounds.Height - edges[1] - edges[3]);
  return bounds;
}

std::vector<Element> Layout(const Page& page, const State& state) {
  std::vector<Element> elements;
  const Gdiplus::RectF bounds(0, 0, static_cast<float>(geometry.width),
                             static_cast<float>(geometry.height));
  for (const auto& root : page.roots) {
    LayoutNode(root, bounds, state, elements);
  }
  return elements;
}

}  // namespace installer
