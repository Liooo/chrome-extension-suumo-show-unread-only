import {
  type Config,
  type Entry,
  getConfig,
  getEntry,
  setConfig,
  setEntry,
} from './storage.ts';

type Section = {
  container: HTMLElement;
  title: HTMLElement;
  links: HTMLAnchorElement[];
};

type ApplyResult = {
  ignored: number;
  visited: number;
};

const hiddenSectionClassName = 'extension-hidden';

const setupPopover = async (sections: Section[], applyResult: ApplyResult) => {
  // add popup
  const popup = document.createElement('div');
  popup.style.cssText =
    'position:fixed;top:0;right:0;background-color:lightblue;border:solid 1px blue;z-index:999999;padding:10px 20px;display:flex;flex-direction:column;gap:10px;';
  popup.id = 'extension-hidden-count';
  document.body.appendChild(popup);

  // add skipped label in popup
  const hiddenCountLabel = document.createElement('div');
  hiddenCountLabel.innerHTML = '-';
  popup.appendChild(hiddenCountLabel);
  // hiddenCountLabel.innerHTML = `${applyResult.ignored} ignored, ${applyResult.visited} visited / ${sections.length} total`;
  const toCheck = sections.length - applyResult.visited - applyResult.ignored;
  hiddenCountLabel.innerHTML = [
    `<div style="color:green">${applyResult.visited} visited</div>`,
    `<div style="color:red">${applyResult.ignored} ignored</div>`,
    `<div>${toCheck} / ${sections.length} to check</div>`,
  ].join('');

  // add toggle button in popup
  const applyStyleField = document.createElement('div');
  const { applyStyle } = await getConfig();
  applyStyleField.innerHTML = `
  <label><input type="radio" name="applyStyle" style="opacity:1;width:initial;" value="grayout" ${applyStyle === 'grayout' ? 'checked' : ''} /><span style="margin-left:15px;">gray out</span></label>
  <label><input type="radio" name="applyStyle" style="opacity:1;width:initial;" value="hide" ${applyStyle === 'hide' ? 'checked' : ''} /><span style="margin-left:15px;">hide</span></label>
  `;
  applyStyleField
    .querySelectorAll<HTMLInputElement>('input')
    .forEach((field) => {
      // biome-ignore lint/suspicious/noExplicitAny: -
      field.onchange = async (e: any) => {
        const next = e.target!.value;
        const config = await getConfig();
        if (next === config.applyStyle) {
          return;
        }
        reapply(sections, next);
        setConfig({ ...config, applyStyle: next });
      };
    });
  popup.appendChild(applyStyleField);

  // setup clear button
  const clearSkippedBtn = document.createElement('button');
  clearSkippedBtn.innerText = 'clear ignored';
  clearSkippedBtn.onclick = () => {
    const ok = confirm('you sure?');
    if (!ok) {
      return;
    }
    chrome.storage.local.clear();
  };
  popup.appendChild(clearSkippedBtn);
};

const setupPage = (sections: Section[]) => {
  // create Ignore All button (DOM.cloneNode won't copy event listeners, so creating each time)
  const createSkipBtn = () => {
    const skipAllBtn = document.createElement('button');
    skipAllBtn.innerText = 'Ignore All';
    skipAllBtn.style.float = 'right';
    skipAllBtn.style.marginLeft = '5px';
    skipAllBtn.style.marginTop = '8px';
    skipAllBtn.onclick = async () => {
      await markAllAsIgnored(sections);
      skipAllBtn.innerText = 'OK, Ignored';
    };
    return skipAllBtn;
  };

  // clone paging section on top
  const pagingSection = document.querySelector('.pagination_set');
  if (!pagingSection || !pagingSection.parentNode) {
    throw new Error('paging section not found');
  }
  document
    .querySelector('#js-leftColumnForm')!
    .prepend(pagingSection.cloneNode(true));

  // add Ignore All button to each paging section
  [...document.querySelectorAll('.pagination_set')].forEach((elem) => {
    elem
      .querySelector('.pagination.pagination_set-nav')!
      .appendChild(createSkipBtn());
  });

  sections.forEach((section) => {
    section.title.addEventListener('click', () => {
      console.log(section);
    });
  });
};

const shouldHide = async (
  section: Section,
): Promise<{ entry: Entry[string]; fromHistory: boolean } | null> => {
  const entry = await getEntry(section.title.innerText);
  if (entry) {
    return { entry, fromHistory: false };
  }

  const hasHistory = await Promise.all(
    section.links.map((link) =>
      chrome.runtime.sendMessage<
        { type: string; url: string },
        { visited: boolean }
      >({ type: 'visited?', url: link.href }),
    ),
  );
  const visited = hasHistory.some((res) => res.visited);
  if (visited) {
    return {
      entry: { addedAt: undefined, reason: 'visited' },
      fromHistory: true,
    };
  }

  return null;
};

const applyStyle = (sectionElem: HTMLElement, style: Config['applyStyle']) => {
  switch (style) {
    case 'grayout': {
      sectionElem.setAttribute('style', 'opacity: 0.5');
      break;
    }
    case 'hide': {
      sectionElem.setAttribute('style', 'display: none');
      break;
    }
  }
};

// reapply style
const reapply = (sections: Section[], style: Config['applyStyle']) => {
  sections.forEach((section) => {
    const sectionElem = section.container;
    if (
      !sectionElem ||
      !sectionElem.classList.contains(hiddenSectionClassName)
    ) {
      return;
    }
    applyStyle(sectionElem, style);
  });
};

const apply = async (
  sections: Section[],
  style: Config['applyStyle'],
): Promise<{ result: ApplyResult }> => {
  let ignoredCount = 0;
  let visitedCount = 0;
  const unawareHistories: Section[] = [];

  // apply styles to sections that should be hidden
  for (const section of sections) {
    const hidden = await shouldHide(section);
    if (!hidden) {
      continue;
    }

    // register sections to storage that are picked from browser history
    if (hidden.fromHistory) {
      unawareHistories.push(section);
    }

    // add count

    switch (hidden.entry.reason) {
      case 'ignored': {
        ignoredCount++;
        break;
      }
      case 'visited': {
        visitedCount++;
        break;
      }
    }

    // do hide the section
    const sectionElem = section.container;
    if (!sectionElem) {
      continue;
    }
    sectionElem.classList.add(hiddenSectionClassName);
    applyStyle(sectionElem, style);

    // add reason label
    const exists = sectionElem.querySelector('.reason-label');
    if (!exists) {
      const reasonLabel = document.createElement('div');
      reasonLabel.classList.add('reason-label');
      const color = hidden.entry.reason === 'ignored' ? 'red' : 'green';
      reasonLabel.setAttribute(
        'style',
        `font-size: 16px; height: 30px; display: flex; justify-content: flex-end; color: ${color};`,
      );
      reasonLabel.innerText =
        hidden.entry.reason === 'ignored' ? '(ignored)' : '(visited)';
      sectionElem.insertBefore(reasonLabel, sectionElem.firstChild);
    }
  }

  // register sections picked with history, to cope with real estate's re-uploading in the future
  unawareHistories.forEach((section) => {
    setEntry(section.title.innerText, 'visited');
  });

  return { result: { ignored: ignoredCount, visited: visitedCount } };
};

const markAllAsIgnored = (sections: Section[]) => {
  sections.forEach((section) => {
    if (section.container.classList.contains(hiddenSectionClassName)) {
      return;
    }
    setEntry(section.title.innerText, 'ignored');
  });
};

const extractSections = (): Section[] => {
  return [...document.querySelectorAll<HTMLElement>('.cassetteitem')].map(
    (section) => {
      const name = section.querySelector<HTMLElement>(
        '.cassetteitem_content-title',
      );
      const links = [
        ...section.querySelectorAll<HTMLAnchorElement>(
          "table.cassetteitem_other a[href*='/chintai']",
        ),
      ];
      if (!name || !links.length) {
        throw new Error('section not found');
      }
      return { container: section, title: name, links };
    },
  );
};

(async function init() {
  const allSections = extractSections();
  const { applyStyle } = await getConfig();
  const { result } = await apply(allSections, applyStyle);
  setupPage(allSections);
  setupPopover(allSections, result);
})();

// migration
// Object.entries(await chrome.storage.local.get()).filter(([k,v])=>k !== 'config').reduce((acc, [k, v])=>{const key = k.split(/[\t\n]+/)[2]; key===undefined && console.log(k); return {...acc, [key]: v}}, {})
