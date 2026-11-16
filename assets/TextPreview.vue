<template>
  <div class="text-preview" :style="{ bottom: playerVisible ? '64px' : '0' }">
    <div class="text-head">
      <span class="text-name" :title="name">{{ name }}</span>
      <template v-if="editing">
        <button class="text-btn text-save" @click="saveEdit" :disabled="saving">{{ saving ? '保存中…' : '保存' }}</button>
        <button class="text-btn" @click="cancelEdit">取消</button>
      </template>
      <template v-else>
        <button v-if="canEdit" class="text-btn" @click="startEdit">编辑</button>
        <button v-if="loaded" class="text-btn" @click="copyText">{{ copied ? '已复制' : '复制' }}</button>
        <a class="text-btn" :href="url" download>下载</a>
      </template>
      <button class="text-btn text-close" @click="$emit('close')" title="关闭预览">✕</button>
    </div>
    <div v-if="status === 'loading'" class="text-state">加载中…</div>
    <div v-else-if="status === 'error'" class="text-state">
      加载失败，请<a :href="url" download>下载后查看</a>。
    </div>
    <div v-else-if="tooLarge" class="text-state">
      文件过大（{{ sizeText }}），站内不直接渲染，请<a :href="url" download>下载后查看</a>。
    </div>
    <textarea v-else-if="editing" class="text-edit" v-model="editText" spellcheck="false"></textarea>
    <div v-else-if="isMarkdown" class="text-md" v-html="renderedHtml"></div>
    <pre v-else class="text-body">{{ displayText }}</pre>
    <div v-if="truncated" class="text-truncated">内容过长，仅显示前 500KB。</div>
  </div>
</template>

<script>
// 站内文本 / Markdown 查看器。
// - 纯文本用插值渲染（Vue 自动转义，绝不走 v-html）。
// - Markdown 用内置渲染器：先全文转义，再只生成白名单标签
//   （标题/粗斜体/代码/链接/图片/列表/引用/表格/分割线），
//   链接只放行 http/https/mailto 与站内锚点，图片只放行 http/https，
//   不引任何第三方渲染库，不执行文件里的脚本。
// - 超大文件（>5MB）不拉取全文，只给下载入口。
function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderInline(s) {
  const codes = [];
  let out = s.replace(/`([^`\n]+)`/g, (_, c) => {
    codes.push(c);
    return '\u0000' + (codes.length - 1) + '\u0000';
  });
  out = out.replace(/!\[([^\]]*)\]\((https?:[^)\s]+)\)/g, '<img alt="$1" src="$2">');
  out = out.replace(
    /\[([^\]]+)\]\((https?:[^)\s]+|mailto:[^)\s]+|#[^)\s]*)\)/g,
    '<a href="$2" target="_blank" rel="noopener">$1</a>'
  );
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/__([^_]+)__/g, '<strong>$1</strong>');
  out = out.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  out = out.replace(/_([^_]+)_/g, '<em>$1</em>');
  out = out.replace(/\u0000(\d+)\u0000/g, (_, i) => '<code>' + codes[+i] + '</code>');
  return out;
}

function renderMarkdown(src) {
  const lines = src.replace(/\r\n?/g, '\n').split('\n');
  let html = '';
  let i = 0;
  const isTableSep = (l) => /^\s*\|?[\s:|-]+\|?\s*$/.test(l) && l.includes('-');
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith('```')) {
      const buf = [];
      i += 1;
      while (i < lines.length && !lines[i].startsWith('```')) {
        buf.push(escapeHtml(lines[i]));
        i += 1;
      }
      i += 1;
      html += '<pre><code>' + buf.join('\n') + '</code></pre>';
      continue;
    }
    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      html += '<h' + heading[1].length + '>' + renderInline(escapeHtml(heading[2])) + '</h' + heading[1].length + '>';
      i += 1;
      continue;
    }
    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      html += '<hr>';
      i += 1;
      continue;
    }
    if (/^\s*>/.test(line)) {
      const buf = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) {
        buf.push(lines[i].replace(/^\s*>\s?/, ''));
        i += 1;
      }
      html += '<blockquote>' + buf.map((l) => renderInline(escapeHtml(l))).join('<br>') + '</blockquote>';
      continue;
    }
    if (/^\s*([-*+]|\d+[.)])\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*([-*+]|\d+[.)])\s+/.test(lines[i])) {
        const m = lines[i].match(/^\s*([-*+]|\d+[.)])\s+(.*)$/);
        items.push({ ordered: /\d/.test(m[1]), text: m[2] });
        i += 1;
      }
      const ordered = items[0].ordered;
      const tag = ordered ? 'ol' : 'ul';
      html += '<' + tag + '>' + items.map((it) => '<li>' + renderInline(escapeHtml(it.text)) + '</li>').join('') + '</' + tag + '>';
      continue;
    }
    if (line.includes('|') && i + 1 < lines.length && isTableSep(lines[i + 1])) {
      const cells = (l) => l.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      const head = cells(line);
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].includes('|') && lines[i].trim() !== '') {
        rows.push(cells(lines[i]));
        i += 1;
      }
      html += '<table><thead><tr>' + head.map((c) => '<th>' + renderInline(escapeHtml(c)) + '</th>').join('') + '</tr></thead><tbody>';
      rows.forEach((r) => {
        html += '<tr>' + r.map((c) => '<td>' + renderInline(escapeHtml(c)) + '</td>').join('') + '</tr>';
      });
      html += '</tbody></table>';
      continue;
    }
    if (line.trim() === '') {
      i += 1;
      continue;
    }
    const buf = [];
    while (
      i < lines.length && lines[i].trim() !== '' &&
      !lines[i].startsWith('```') && !lines[i].match(/^(#{1,6})\s+/) &&
      !/^\s*([-*+]|\d+[.)])\s+/.test(lines[i]) && !/^\s*>/.test(lines[i])
    ) {
      buf.push(lines[i]);
      i += 1;
    }
    html += '<p>' + buf.map((l) => renderInline(escapeHtml(l))).join('<br>') + '</p>';
  }
  return html;
}

export default {
  props: {
    url: { type: String, required: true },
    name: { type: String, default: '' },
    isMarkdown: { type: Boolean, default: false },
    size: { type: Number, default: 0 },
    playerVisible: { type: Boolean, default: false },
    // 挂载内文本文件时 App.vue 传 true，才显示“编辑”按钮。
    editable: { type: Boolean, default: false },
    saving: { type: Boolean, default: false },
  },

  emits: ['close', 'save'],

  data() {
    return {
      status: 'loading',
      rawText: '',
      truncated: false,
      copied: false,
      // 编辑态：编辑的是原始文本（Markdown 编辑的也是源码，不是渲染后的 HTML）。
      editing: false,
      editText: '',
    };
  },

  computed: {
    loaded() {
      return this.status === 'ready';
    },
    // 编辑按钮的出现条件：App.vue 已 gate 挂载内 + 文本 + ≤500KB；
    // 这里再 gate 全文已加载且未截断（超过 500KB 拉到的不是全文，
    // 编辑会丢内容，宁可不给编）。
    canEdit() {
      return this.editable && this.status === 'ready' && !this.truncated && !this.tooLarge;
    },
    tooLarge() {
      return this.size > 5 * 1024 * 1024;
    },
    sizeText() {
      const s = this.size;
      if (s >= 1024 * 1024) return (s / 1024 / 1024).toFixed(1) + ' MB';
      if (s >= 1024) return (s / 1024).toFixed(1) + ' KB';
      return s + ' B';
    },
    displayText() {
      return this.rawText;
    },
    renderedHtml() {
      return this.isMarkdown ? renderMarkdown(this.rawText) : '';
    },
  },

  watch: {
    url() {
      this.load();
    },
  },

  created() {
    this.load();
  },

  methods: {
    load() {
      this.status = 'loading';
      this.rawText = '';
      this.truncated = false;
      this.copied = false;
      this.editing = false;
      this.editText = '';
      if (this.tooLarge) {
        this.status = 'ready';
        return;
      }
      fetch(this.url)
        .then((r) => {
          if (!r.ok) throw new Error('fetch failed');
          return r.text();
        })
        .then((t) => {
          if (t.length > 500000) {
            this.rawText = t.slice(0, 500000);
            this.truncated = true;
          } else {
            this.rawText = t;
          }
          this.status = 'ready';
        })
        .catch(() => {
          this.status = 'error';
        });
    },

    copyText() {
      const text = this.rawText;
      if (!text) return;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text)
          .then(() => {
            this.copied = true;
            setTimeout(() => { this.copied = false; }, 2000);
          })
          .catch(() => {});
      }
    },

    // 编辑态：只改本地文本，不自己发 PUT——保存时 $emit('save')，
    // 由 App.vue 统一走 davFetch（冲突检测 + PUT 覆盖）。
    startEdit() {
      if (!this.canEdit) return;
      this.editText = this.rawText;
      this.editing = true;
    },

    cancelEdit() {
      if (this.editText !== this.rawText) {
        if (!window.confirm('放弃未保存的修改？')) return;
      }
      this.editing = false;
      this.editText = '';
    },

    saveEdit() {
      if (this.saving) return;
      this.$emit('save', this.editText);
      // 保存成功后 App.vue 会把 :key +1 强制重新拉取，editing 随之复位；
      // 保存失败时保持编辑态，让用户改完再试。
    },
  },
};
</script>

<style>
.text-preview {
  position: fixed;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  width: min(860px, 94vw);
  height: min(78vh, 720px);
  z-index: 96;
  background: #fff;
  border: 1px solid rgba(57, 144, 155, 0.3);
  border-radius: 16px;
  box-shadow: 0 18px 40px rgba(0, 0, 0, 0.18);
  color: #24292f;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.text-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
  flex-shrink: 0;
}
.text-name {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-weight: 600;
}
.text-btn {
  border: 1px solid rgba(57, 144, 155, 0.45);
  background: #fff;
  border-radius: 12px;
  padding: 6px 12px;
  cursor: pointer;
  color: rgb(57, 144, 155);
  text-decoration: none;
  font-size: 14px;
  white-space: nowrap;
}
.text-state {
  padding: 24px;
  text-align: center;
  color: #57606a;
}
.text-body {
  margin: 0;
  padding: 16px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 14px;
  line-height: 1.6;
}
.text-md {
  padding: 16px 20px;
  overflow: auto;
  line-height: 1.7;
  word-break: break-word;
}
.text-md h1, .text-md h2, .text-md h3 {
  margin: 16px 0 8px;
}
.text-md pre {
  background: rgba(0, 0, 0, 0.05);
  padding: 12px;
  border-radius: 8px;
  overflow: auto;
}
.text-md code {
  background: rgba(0, 0, 0, 0.05);
  padding: 1px 5px;
  border-radius: 4px;
}
.text-md pre code {
  background: none;
  padding: 0;
}
.text-md img {
  max-width: 100%;
}
.text-md table {
  border-collapse: collapse;
}
.text-md th, .text-md td {
  border: 1px solid rgba(0, 0, 0, 0.12);
  padding: 6px 10px;
}
.text-md blockquote {
  border-left: 3px solid rgb(57, 144, 155);
  margin: 12px 0;
  padding: 4px 12px;
  color: #57606a;
}
.text-truncated {
  padding: 8px 16px;
  border-top: 1px solid rgba(0, 0, 0, 0.08);
  color: #57606a;
  font-size: 13px;
  flex-shrink: 0;
}
.text-edit {
  flex: 1;
  min-height: 0;
  margin: 0;
  padding: 16px;
  border: 0;
  outline: none;
  resize: none;
  white-space: pre;
  word-break: break-word;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 14px;
  line-height: 1.6;
  color: #24292f;
  background: #fff;
}
.text-save {
  border-color: rgb(57, 144, 155);
  background: rgb(57, 144, 155);
  color: #fff;
}
.text-save:disabled {
  opacity: 0.6;
  cursor: default;
}
</style>
