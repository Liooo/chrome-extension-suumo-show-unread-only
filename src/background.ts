chrome.runtime.onMessage.addListener(({ type, url }, _, sendResponse) => {
  if (type !== 'visited?') {
    return;
  }

  (async () => {
    const visits = await chrome.history.getVisits({ url });
    sendResponse({ visited: visits.length > 0 });
  })();

  return true;
});
