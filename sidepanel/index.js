// The underlying model has a context of 1,024 tokens, out of which 26 are used by the internal prompt,
// leaving about 998 tokens for the input text. Each token corresponds, roughly, to about 4 characters, so 4,000
// is used as a limit to warn the user the content might be too long to summarize.
const MAX_MODEL_CHARS = 4000;

let pageContent = "";

const summaryElement = document.body.querySelector("#summary");
const languageSelect = document.querySelector("#language");
const settingsTab = document.querySelector("#settings-tab");
const settingsPanel = document.querySelector("#settings-panel");
const settingsCard = document.querySelector("#card");
const cardContainer = document.getElementById("card-container");

function onConfigChange() {
  const oldContent = pageContent;
  pageContent = "";
  onContentChange(oldContent);
}

[languageSelect].forEach((e) => e.addEventListener("change", onConfigChange));

chrome.storage.session.get("pageContent", ({ pageContent }) => {
  onContentChange(pageContent);
});

chrome.storage.session.onChanged.addListener((changes) => {
  const pageContent = changes["pageContent"];
  onContentChange(pageContent.newValue);
  const cardContainer = document.getElementById("card-container");
  if (cardContainer) {
    cardContainer.innerHTML = ""; // Clear the cards inside the container
  }
});

async function onContentChange(newContent) {
  if (pageContent == newContent) {
    // no new content, do nothing
    return;
  }
  pageContent = newContent;
  let summary;
  if (newContent) {
    showSummary("Loading...");
    summary = await generateSummary(newContent);
  } else {
    summary = "There's nothing to summarize";
  }
  if (languageSelect.value !== "en") {
    try {
      summary = await translateText(summary, languageSelect.value);
    } catch (error) {
      console.error("Error during translation:", error);
    }
  }
  console.log(summary);
  showSummary(summary);
}
async function translateText(sourceContent, targetLanguage) {
  try {
    const translator = await createTranslator("en", targetLanguage);
    return await translator.translate(sourceContent);
  } catch (error) {
    console.error("Translation failed:", error);
    return "Translation error: Unable to process the text.";
  }
}
async function createTranslator(sourceLanguage, targetLanguage) {
  if (!self.translation) {
    console.log("No translation model");
    throw new Error("AI Translation is not supported in this browser");
  }
  const translator = await self.translation.createTranslator({
    sourceLanguage,
    targetLanguage,
  });
  return translator;
}
async function generateSummary(text) {
  try {
    const session = await createSummarizer(
      {
        type: "key-points",
        format: "markdown",
        length: "short",
      },
      (message, progress) => {
        console.log(`${message} (${progress.loaded}/${progress.total})`);
      }
    );
    const chunks = [];
    let startIndex = 0;
    while (startIndex < text.length) {
      const chunk = text.slice(startIndex, startIndex + MAX_MODEL_CHARS);
      chunks.push(chunk);
      startIndex += MAX_MODEL_CHARS;
    }
    let finalSummary = "";
    for (let i = 0; i < chunks.length; i++) {
      const chunkSummary = await session.summarize(chunks[i]);
      finalSummary += chunkSummary + "\n";
    }
    finalSummary.trim();
    // const summary = await session.summarize(text, {
    //   context: "This is a news article.",
    // });
    session.destroy();
    return finalSummary;
  } catch (e) {
    console.log("Summary generation failed");
    console.error(e);
    return "Error: " + e.message;
  }
}

async function createSummarizer(config, downloadProgressCallback) {
  if (!"ai" in self || !"summarizer" in self.ai) {
    throw new Error("AI Summarization is not supported in this browser");
  }
  const canSummarize = await self.ai.summarizer.capabilities();
  if (canSummarize.available === "no") {
    throw new Error("AI Summarization is not supported");
  }
  const summarizationSession = await self.ai.summarizer.create(
    config,
    downloadProgressCallback
  );
  if (canSummarize.available === "after-download") {
    summarizationSession.addEventListener(
      "downloadprogress",
      downloadProgressCallback
    );
    await summarizationSession.ready;
  }
  return summarizationSession;
}

async function showSummary(text) {
  //summaryElement.innerHTML = text;
  const formattedText = text
    .split("*")
    .filter((line) => line.trim() !== "") // Remove empty lines
    .map((line) => `<li>${line.trim()}</li>`) // Wrap each line in a list item
    .join("");

  summaryElement.innerHTML = `<ul>${formattedText}</ul>`;
}

settingsTab.addEventListener("click", () => {
  settingsTab.classList.toggle("change");
  // settingsCard.classList.toggle("collapsed");
  const isExpanded = settingsTab.getAttribute("aria-expanded") === "true";
  if (isExpanded) {
    settingsPanel.style.display = "none";
    settingsTab.setAttribute("aria-expanded", "false");
  } else {
    settingsPanel.style.display = "block";
    settingsTab.setAttribute("aria-expanded", "true");
  }
});

// Function to create a new card
function createNewCard(origtext, text) {
  // Create a new div element with the class 'card'
  const newCard = document.createElement("div");
  newCard.classList.add("card");
  // Create a span for the 'selected:' text with a different font
  const selectedText = document.createElement("span");
  selectedText.classList.add("selected-text");
  selectedText.textContent = "selected: ";

  // Create a div or text node for the rest of the content
  const restText = document.createElement("span");
  restText.classList.add("selected-text-2");
  restText.textContent = " " + origtext;

  const newLineText = document.createElement("div");
  newLineText.textContent = "This is some additional text on a new line.";

  // Append the selected text and the rest of the text to the card
  newCard.appendChild(selectedText);
  newCard.appendChild(restText);
  newCard.appendChild(newLineText); // Add it to the card
  cardContainer.appendChild(newCard);
}

// Listen for messages in the side panel (index.js)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "selectedTextFromBackground") {
    const selectedText = message.text;
    // console.log("Received selected text in side panel:", selectedText);

    // Update your side panel here
    // For example, show the text in a DOM element in the side panel
    createNewCard(selectedText, selectedText);
  }
});
