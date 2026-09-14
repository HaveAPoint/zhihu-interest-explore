// Zhihu Zhuanlan DOM extractor and article adapter
// Complies with 作者本人开发计划 §4.1, T18

export interface ExtractedZhihuArticle {
  zhihu_id: string;
  url: string;
  title: string;
  tags: string[];
  lead: string;
  content_text: string;
  containerElement: HTMLElement | null;
}

export function extractZhihuIdFromUrl(url: string = window.location.href): string | null {
  const match = url.match(/zhuanlan\.zhihu\.com\/p\/(\d+)/);
  return match ? match[1]! : null;
}

export function isZhihuZhuanlanPage(): boolean {
  return extractZhihuIdFromUrl() !== null;
}

export function extractArticleFromDOM(): ExtractedZhihuArticle | null {
  const zhihu_id = extractZhihuIdFromUrl();
  if (!zhihu_id) return null;

  // Title selectors
  const titleEl =
    document.querySelector('.Post-Title') ||
    document.querySelector('h1.Post-Title') ||
    document.querySelector('.PostHeader-title') ||
    document.querySelector('h1');

  const title = titleEl?.textContent?.trim() || document.title.replace(/ - 知乎$/, '').trim();

  // Tags selectors
  const tagElements = document.querySelectorAll(
    '.Post-Topic-Item, .Topic-link, .Tag, [data-za-detail-view-path-module="TopicItem"]'
  );
  const tags: string[] = [];
  tagElements.forEach((el) => {
    const t = el.textContent?.trim();
    if (t && !tags.includes(t)) tags.push(t);
  });

  // Content container
  const container =
    (document.querySelector('.Post-RichText') as HTMLElement) ||
    (document.querySelector('.RichText') as HTMLElement) ||
    (document.querySelector('article') as HTMLElement);

  let lead = '';
  let content_text = '';

  if (container) {
    // Clone container to sanitize and prevent plugin badge text polluting content_text (§3.7)
    const clone = container.cloneNode(true) as HTMLElement;
    const pluginElements = clone.querySelectorAll('[class*="zhihu-explore"]');
    pluginElements.forEach((el) => el.remove());

    const paragraphs = Array.from(clone.querySelectorAll('p'));

    if (paragraphs.length > 0) {
      lead = paragraphs[0]?.textContent?.trim() || '';
      content_text = paragraphs.map((p) => p.textContent?.trim()).filter(Boolean).join('\n\n');
    } else {
      content_text = clone.innerText || clone.textContent || '';
      lead = content_text.slice(0, 150);
    }
  }

  return {
    zhihu_id,
    url: window.location.href.split('?')[0]!,
    title,
    tags,
    lead,
    content_text,
    containerElement: container,
  };
}
