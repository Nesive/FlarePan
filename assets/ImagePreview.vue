<template>
  <div class="image-preview" @click.self="$emit('close')">
    <div class="image-top">
      <span class="image-name" :title="current.name">{{ current.name }}</span>
      <span class="image-count">{{ currentIndex + 1 }} / {{ images.length }}</span>
      <a class="image-btn" :href="current.url" download>下载</a>
      <button class="image-btn image-close" @click="$emit('close')" title="关闭">✕</button>
    </div>
    <button
      v-if="images.length > 1"
      class="image-nav image-prev"
      :disabled="currentIndex === 0"
      @click="step(-1)"
      title="上一张">‹</button>
    <div class="image-stage" :class="{ zoomed }" @click="onStageClick"
      @touchstart="onTouchStart" @touchend="onTouchEnd">
      <img
        v-if="!failed"
        :src="current.url"
        :alt="current.name"
        @error="failed = true">
      <div v-else class="image-error">
        浏览器无法显示该图片，请<a :href="current.url" download>下载后查看</a>。
      </div>
    </div>
    <button
      v-if="images.length > 1"
      class="image-nav image-next"
      :disabled="currentIndex === images.length - 1"
      @click="step(1)"
      title="下一张">›</button>
  </div>
</template>

<script>
// 站内图片灯箱：同一文件夹的图片可上一张 / 下一张切换，
// 点图片在适应窗口与原始尺寸之间切换，左右方向键切换、Esc 关闭。
// 图片用 <img> 加载（不执行 SVG 里的脚本）；浏览器解不了的格式
// （如 tiff）显示站内错误 + 下载，不踢出站外。
export default {
  props: {
    images: { type: Array, required: true },
    index: { type: Number, default: 0 },
  },

  emits: ['close'],

  data() {
    return {
      currentIndex: this.index,
      failed: false,
      zoomed: false,
      touchStartX: 0,
      touchStartY: 0,
      // 滑动换图后浏览器可能仍合成一次 click：锁住它，不触发缩放。
      swipeLock: false,
    };
  },

  computed: {
    current() {
      return this.images[this.currentIndex] || {};
    },
  },

  watch: {
    index(v) {
      this.currentIndex = v;
      this.failed = false;
      this.zoomed = false;
    },
    images() {
      if (this.currentIndex >= this.images.length) this.currentIndex = 0;
      this.failed = false;
      this.zoomed = false;
    },
    currentIndex() {
      this.preloadNeighbors();
    },
  },

  mounted() {
    window.addEventListener('keydown', this.onKey);
    this.preloadNeighbors();
  },

  beforeUnmount() {
    window.removeEventListener('keydown', this.onKey);
  },

  methods: {
    step(d) {
      const next = this.currentIndex + d;
      if (next < 0 || next >= this.images.length) return;
      this.currentIndex = next;
      this.failed = false;
      this.zoomed = false;
    },

    onKey(e) {
      if (e.key === 'ArrowLeft') this.step(-1);
      else if (e.key === 'ArrowRight') this.step(1);
      else if (e.key === 'Escape') this.$emit('close');
    },

    // 预加载相邻图：切换到下一张时图片已在缓存里，立即显示、不空白。
    preloadNeighbors() {
      const urls = [];
      if (this.currentIndex > 0) {
        const prev = this.images[this.currentIndex - 1];
        if (prev && prev.url) urls.push(prev.url);
      }
      if (this.currentIndex < this.images.length - 1) {
        const next = this.images[this.currentIndex + 1];
        if (next && next.url) urls.push(next.url);
      }
      urls.forEach((url) => {
        const im = new Image();
        im.src = url;
      });
    },

    onStageClick() {
      if (this.swipeLock) return;
      this.zoomed = !this.zoomed;
    },

    // 手机滑动换图：未放大时横滑 >60px 且横向主导则换图；放大时
    // 横滑留给图片自身的滚动（见 touch-action），不换图。
    onTouchStart(e) {
      const t = e.changedTouches && e.changedTouches[0];
      if (!t) return;
      this.touchStartX = t.clientX;
      this.touchStartY = t.clientY;
    },

    onTouchEnd(e) {
      if (this.zoomed) return;
      const t = e.changedTouches && e.changedTouches[0];
      if (!t) return;
      const dx = t.clientX - this.touchStartX;
      const dy = t.clientY - this.touchStartY;
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        // 锁住随后可能合成的 click，免得换图后立刻被缩放。
        this.swipeLock = true;
        setTimeout(() => {
          this.swipeLock = false;
        }, 80);
        this.step(dx < 0 ? 1 : -1);
      }
    },
  },
};
</script>

<style>
.image-preview {
  position: fixed;
  inset: 0;
  z-index: 96;
  background: rgba(15, 15, 15, 0.92);
  display: flex;
  flex-direction: column;
}
.image-top {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  color: #fff;
  flex-shrink: 0;
}
.image-name {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.image-count {
  color: #8b949e;
  font-size: 14px;
  white-space: nowrap;
}
.image-btn {
  border: 1px solid rgba(0, 229, 255, 0.45);
  background: rgba(12, 9, 36, 0.75);
  color: #e6edf3;
  border-radius: 12px;
  padding: 6px 12px;
  cursor: pointer;
  text-decoration: none;
  font-size: 14px;
  white-space: nowrap;
}
.image-stage {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  cursor: zoom-in;
  padding: 8px;
  /* 横滑由 JS 接管换图，竖滑仍走原生滚动（放大后看图用）。 */
  touch-action: pan-y;
}
.image-stage.zoomed {
  overflow: auto;
  cursor: zoom-out;
  touch-action: auto;
}
.image-stage img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}
.image-stage.zoomed img {
  max-width: none;
  max-height: none;
}
.image-nav {
  position: fixed;
  top: 50%;
  transform: translateY(-50%);
  width: 44px;
  height: 44px;
  border-radius: 12px;
  border: 1px solid rgba(0, 229, 255, 0.45);
  background: rgba(12, 9, 36, 0.75);
  color: #e6edf3;
  font-size: 26px;
  cursor: pointer;
  z-index: 1;
}
.image-nav:disabled {
  opacity: 0.3;
  cursor: default;
}
.image-prev {
  left: 12px;
}
.image-next {
  right: 12px;
}
.image-error {
  color: #fff;
  text-align: center;
}
.image-error a {
  color: #00e5ff;
}
</style>
