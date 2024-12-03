chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error));
chrome.tabs.onActivated.addListener((activeInfo) => {
  showSummary(activeInfo.tabId);
});
chrome.tabs.onUpdated.addListener(async (tabId) => {
  showSummary(tabId);
});
async function showSummary(tabId) {
  const tab = await chrome.tabs.get(tabId);
  if (!tab.url.startsWith("http")) {
    return;
  }
  try {
    // Inject a script into the tab to extract the page's text content
    const [result] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        // Function runs in the context of the page
        return document.body.innerText || "";
      },
    });

    const contentText = result.result;
    // Save the extracted text in session storage
    chrome.storage.session.set({ pageContent: contentText });
    console.log("Extracted Text:", contentText); // For debugging
  } catch (error) {
    console.error("Failed to extract text:", error);
  }
}
