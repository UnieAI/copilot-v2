import { ParsedContent } from "./type";

export function safeParseJson<T = any>(raw: string | undefined | null): T | null {
  if (!raw || typeof raw !== "string") return null;
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed === "object" && parsed !== null) {
      return parsed;
    }
    return null;
  } catch (e) {
    console.warn("safeParseJson 失敗：", e);
    return null;
  }
}

// export function parseContent(text: string): ParsedContent {
//   const _start: string = "[[_START_]]";
//   const _end: string = "[[_END_]]";

//   let _text: string = text.split('\n')
//     .filter(line => line.trim() !== '')
//     .join('\n');

//   // 先檢查是否有未封閉的 <think>
//   const hasUnclosedThink: boolean = /<think>/.test(_text) && !/<\/think>/.test(_text);
//   if (hasUnclosedThink) {
//     _text = _text.replace(/<think>/, '<think>') + '</think>'; // 強制補上閉合
//   }

//   // 標記 think 區塊
//   _text = _text.replace(/<think>([\s\S]*?)<\/think>/g, (match, content) => {
//     return `${_start}${content}${_end}`;
//   });

//   // Markdown 處理
//   _text = _text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
//   _text = _text.replace(/\*(.*?)\*/g, '<em>$1</em>');
//   _text = _text.replace(/^# (.*?)$/gm, '<h1>$1</h1>');
//   _text = _text.replace(/^## (.*?)$/gm, '<h2>$1</h2>');
//   _text = _text.replace(/^### (.*?)$/gm, '<h3>$1</h3>');
//   _text = _text.replace(/^#### (.*?)$/gm, '<h4>$1</h4>');
//   _text = _text.replace(/^##### (.*?)$/gm, '<h5>$1</h5>');
//   _text = _text.replace(/^###### (.*?)$/gm, '<h6>$1</h6>');
//   _text = _text.replace(/^- (.*?)$/gm, '<li>$1</li>');
//   _text = _text.replace(/(<li>.*?<\/li>)/g, '<ul>$1</ul>');

//   // 用正則拆分出 think 與 content 區塊
//   const textParts: string[] = _text.split(/(\[\[_START_\]\][\s\S]*?\[\[_END_\]\])/g);

//   let reason: string = '';
//   let content: string = '';

//   textParts.forEach(part => {
//     if (part.startsWith(_start)) {
//       reason += part.replace(_start, '').replace(_end, '');
//     } else {
//       content += part;
//     }
//   });

//   return {
//     content: content,
//     reason: reason,
//   };
// };

export function parseContent(text: string): ParsedContent {
  const _start = "[[_START_]]";
  const _end = "[[_END_]]";

  const containers: string[] = ["think", "reason"]; // 可擴充容器列表
  let matchedContainer: string | null = null;

  let _text: string = text.split('\n')
    .filter(line => line.trim() !== '')
    .join('\n');

  for (const tag of containers) {
    const openTag = `<${tag}>`;
    const closeTag = `</${tag}>`;

    if (_text.includes(openTag)) {
      matchedContainer = tag;

      // 若未閉合，自動補上
      if (!_text.includes(closeTag)) {
        _text += closeTag;
      }

      // 標記區塊
      const regex = new RegExp(`<${tag}>([\\s\\S]*?)<\/${tag}>`, 'g');
      _text = _text.replace(regex, (_match, content) => {
        return `${_start}${content}${_end}`;
      });

      break; // 假設同時只可能有一種容器存在
    }
  }

  // Markdown 處理
  _text = _text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  _text = _text.replace(/\*(.*?)\*/g, '<em>$1</em>');
  _text = _text.replace(/^# (.*?)$/gm, '<h1>$1</h1>');
  _text = _text.replace(/^## (.*?)$/gm, '<h2>$1</h2>');
  _text = _text.replace(/^### (.*?)$/gm, '<h3>$1</h3>');
  _text = _text.replace(/^#### (.*?)$/gm, '<h4>$1</h4>');
  _text = _text.replace(/^##### (.*?)$/gm, '<h5>$1</h5>');
  _text = _text.replace(/^###### (.*?)$/gm, '<h6>$1</h6>');
  _text = _text.replace(/^- (.*?)$/gm, '<li>$1</li>');
  _text = _text.replace(/(<li>.*?<\/li>)/g, '<ul>$1</ul>');

  // 拆分 think/reason 與主要內容
  const textParts: string[] = _text.split(/(\[\[_START_\]\][\s\S]*?\[\[_END_\]\])/g);

  let reason = '';
  let content = '';

  textParts.forEach(part => {
    if (part.startsWith(_start)) {
      reason += part.slice(_start.length, -_end.length);
    } else {
      content += part;
    }
  });

  return {
    content,
    reason
  };
}
