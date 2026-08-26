function graphqlPayload(result) {
  return result && result.data && result.data.data
    ? result.data.data
    : result.data;
}

function commentFields() {
  return `
              id
              databaseId
              body
              author {
                login
              }
              createdAt`;
}

function reviewThreadsQuery(hasCursor) {
  return `
query($owner: String!, $repo: String!, $pr: Int!${
    hasCursor ? ', $threadCursor: String!' : ''
  }) {
  repository(owner: $owner, name: $repo) {
    pullRequest(number: $pr) {
      id
      reviewThreads(first: 100${hasCursor ? ', after: $threadCursor' : ''}) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          id
          isResolved
          isOutdated
          path
          line
          startLine
          diffSide
          comments(first: 100) {
            pageInfo {
              hasNextPage
              endCursor
            }
            nodes {
${commentFields()}
            }
          }
        }
      }
    }
  }
}`;
}

function threadCommentsQuery() {
  return `
query($threadId: ID!, $commentCursor: String!) {
  node(id: $threadId) {
    ... on PullRequestReviewThread {
      comments(first: 100, after: $commentCursor) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
${commentFields()}
        }
      }
    }
  }
}`;
}

function getThreadConnection(graphqlData) {
  const payload = graphqlPayload({ data: graphqlData });
  return (
    (payload &&
      payload.repository &&
      payload.repository.pullRequest &&
      payload.repository.pullRequest.reviewThreads) || {
      nodes: [],
      pageInfo: { hasNextPage: false },
    }
  );
}

function getThreads(graphqlData) {
  const connection = getThreadConnection(graphqlData);
  return connection.nodes || [];
}

function threadComments(thread) {
  if (Array.isArray(thread.comments)) {
    return thread.comments;
  }
  return (thread.comments && thread.comments.nodes) || [];
}

function latestComment(thread) {
  const comments = threadComments(thread);
  return comments.length ? comments[comments.length - 1] : null;
}

function rootComment(thread) {
  const comments = threadComments(thread);
  return comments.length ? comments[0] : null;
}

function reviewThreadDataFlags(graphqlData) {
  const connection = getThreadConnection(graphqlData);
  const nodes = connection.nodes || [];
  const threadPageTruncated = Boolean(
    connection.pageInfo && connection.pageInfo.hasNextPage,
  );
  const commentPageTruncated = nodes.some(
    (thread) =>
      thread.comments &&
      thread.comments.pageInfo &&
      (thread.comments.pageInfo.hasNextPage ||
        thread.comments.pageInfo.hasPreviousPage),
  );

  return {
    dataComplete: !threadPageTruncated && !commentPageTruncated,
    threadPageTruncated,
    commentPageTruncated,
  };
}

function reviewThreadData(nodes) {
  return {
    repository: {
      pullRequest: {
        reviewThreads: {
          nodes,
          pageInfo: {
            hasNextPage: false,
            endCursor: '',
          },
        },
      },
    },
  };
}

function failedResult(result, logPaths, message) {
  return {
    ...result,
    ok: false,
    data: null,
    error: message,
    logPath: (result && result.logPath) || logPaths[0] || '',
    logPaths,
  };
}

function runReviewThreadsPage({
  logDir,
  owner,
  repo,
  prNumber,
  threadCursor,
  pageNumber,
  runJsonCommand,
}) {
  const args = [
    'api',
    'graphql',
    '-f',
    `query=${reviewThreadsQuery(Boolean(threadCursor))}`,
    '-f',
    `owner=${owner}`,
    '-f',
    `repo=${repo}`,
    '-F',
    `pr=${prNumber}`,
  ];
  if (threadCursor) {
    args.push('-f', `threadCursor=${threadCursor}`);
  }
  return runJsonCommand(
    logDir,
    pageNumber === 1
      ? 'gh-review-threads'
      : `gh-review-threads-page-${pageNumber}`,
    'gh',
    args,
  );
}

function runThreadCommentsPage({
  logDir,
  threadId,
  commentCursor,
  pageNumber,
  runJsonCommand,
}) {
  return runJsonCommand(
    logDir,
    `gh-review-thread-comments-${threadId.slice(-8)}-${pageNumber}`,
    'gh',
    [
      'api',
      'graphql',
      '-f',
      `query=${threadCommentsQuery()}`,
      '-f',
      `threadId=${threadId}`,
      '-f',
      `commentCursor=${commentCursor}`,
    ],
  );
}

function getReviewThreadsConnection(result, prNumber) {
  const payload = graphqlPayload(result);
  const connection =
    payload &&
    payload.repository &&
    payload.repository.pullRequest &&
    payload.repository.pullRequest.reviewThreads;

  if (!connection || !Array.isArray(connection.nodes)) {
    throw new Error(`No review thread data found for PR #${prNumber}.`);
  }

  return connection;
}

function getThreadCommentsConnection(result, threadId) {
  const payload = graphqlPayload(result);
  const connection = payload && payload.node && payload.node.comments;

  if (!connection || !Array.isArray(connection.nodes)) {
    throw new Error(`No review comment data found for thread ${threadId}.`);
  }

  return connection;
}

function normalizeThread(thread, comments) {
  return {
    ...thread,
    comments: {
      nodes: comments,
      pageInfo: {
        hasNextPage: false,
        hasPreviousPage: false,
        endCursor: '',
      },
    },
  };
}

function fetchReviewThreads({ logDir, owner, repo, prNumber, runJsonCommand }) {
  const nodes = [];
  const logPaths = [];
  let threadCursor = '';
  let threadPageNumber = 1;

  for (;;) {
    const pageResult = runReviewThreadsPage({
      logDir,
      owner,
      repo,
      prNumber,
      threadCursor,
      pageNumber: threadPageNumber,
      runJsonCommand,
    });
    logPaths.push(pageResult.logPath);

    if (!pageResult.ok || !pageResult.data) {
      return failedResult(
        pageResult,
        logPaths,
        `Unable to fetch review thread page ${threadPageNumber}.`,
      );
    }

    let connection;
    try {
      connection = getReviewThreadsConnection(pageResult, prNumber);
    } catch (error) {
      return failedResult(pageResult, logPaths, error.message);
    }

    for (const thread of connection.nodes) {
      let comments = threadComments(thread);
      let commentConnection = thread.comments || {
        pageInfo: { hasNextPage: false },
      };
      let commentPageNumber = 2;

      while (
        commentConnection.pageInfo &&
        commentConnection.pageInfo.hasNextPage
      ) {
        const commentCursor = commentConnection.pageInfo.endCursor;
        if (!commentCursor) {
          return failedResult(
            pageResult,
            logPaths,
            `Review comment page is missing an endCursor for thread ${thread.id}.`,
          );
        }

        const commentResult = runThreadCommentsPage({
          logDir,
          threadId: thread.id,
          commentCursor,
          pageNumber: commentPageNumber,
          runJsonCommand,
        });
        logPaths.push(commentResult.logPath);

        if (!commentResult.ok || !commentResult.data) {
          return failedResult(
            commentResult,
            logPaths,
            `Unable to fetch review comments for thread ${thread.id}.`,
          );
        }

        try {
          commentConnection = getThreadCommentsConnection(
            commentResult,
            thread.id,
          );
        } catch (error) {
          return failedResult(commentResult, logPaths, error.message);
        }
        comments = comments.concat(commentConnection.nodes || []);
        commentPageNumber += 1;
      }

      nodes.push(normalizeThread(thread, comments));
    }

    if (!(connection.pageInfo && connection.pageInfo.hasNextPage)) {
      break;
    }

    threadCursor = connection.pageInfo.endCursor;
    if (!threadCursor) {
      return failedResult(
        pageResult,
        logPaths,
        'Review thread page is missing an endCursor.',
      );
    }
    threadPageNumber += 1;
  }

  return {
    ok: true,
    data: reviewThreadData(nodes),
    logPath: logPaths[0] || '',
    logPaths,
  };
}

module.exports = {
  fetchReviewThreads,
  getThreads,
  latestComment,
  reviewThreadDataFlags,
  rootComment,
  threadComments,
};
