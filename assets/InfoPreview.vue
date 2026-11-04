<template>
  <Dialog :model-value="true" @update:model-value="$emit('close')">
    <div class="info-preview">
      <MimeIcon :content-type="file.type" />
      <div class="info-name" :title="file.name">{{ file.name }}</div>
      <div class="info-meta">{{ file.sizeText }} · {{ file.type || '未知类型' }}</div>
      <div class="info-note">{{ note }}</div>
      <div class="info-actions">
        <a class="info-btn" :href="file.url" download>下载</a>
        <button class="info-btn" @click="$emit('close')">关闭</button>
      </div>
    </div>
  </Dialog>
</template>

<script>
// 兜底卡片：所有没有专属查看器的格式点开都落到这里，站内展示
// 文件信息 + 下载，绝不踢出站外、不留空白页。
// Office 文档、压缩包、可执行文件与未知格式目前只给下载入口，
// 不在站内渲染（渲染它们需要重型第三方库，且 HTML 类文件以内嵌
// 方式打开会有脚本注入风险，统一走下载最安全）。
import Dialog from './Dialog.vue';
import MimeIcon from './MimeIcon.vue';

export default {
  components: { Dialog, MimeIcon },

  props: {
    file: { type: Object, required: true },
  },

  emits: ['close'],

  computed: {
    note() {
      const ext = (this.file.name.split('.').pop() || '').toLowerCase();
      if (['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'odp', 'pages', 'numbers', 'key'].includes(ext)) {
        return 'Office 文档暂不支持站内渲染，可下载后查看。';
      }
      if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz'].includes(ext)) {
        return '压缩包暂不支持站内解压预览，可下载后查看。';
      }
      if (['exe', 'msi', 'apk', 'dmg', 'pkg', 'bat', 'sh'].includes(ext)) {
        return '可执行文件不支持预览，可下载后查看。';
      }
      return '该格式暂不支持站内预览，可下载后查看。';
    },
  },
};
</script>

<style>
.info-preview {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 20px 24px;
  max-width: min(420px, 88vw);
  text-align: center;
}
.info-name {
  font-weight: 600;
  word-break: break-all;
}
.info-meta {
  color: #888;
  font-size: 13px;
}
.info-note {
  color: #555;
  font-size: 14px;
  line-height: 1.6;
}
.info-actions {
  display: flex;
  gap: 10px;
  margin-top: 6px;
}
.info-btn {
  border: 1px solid #d0d0d0;
  background: #fff;
  border-radius: 8px;
  padding: 8px 20px;
  cursor: pointer;
  color: #39909b;
  text-decoration: none;
  font-size: 14px;
}
</style>
