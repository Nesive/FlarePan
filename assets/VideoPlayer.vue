<template>
  <div class="video-player" :class="mode" ref="box">
    <div class="video-head">
      <span class="video-name" :title="name">{{ name }}</span>
      <button
        v-if="mode === 'center'"
        class="video-btn"
        @click="mode = 'mini'"
        title="切换到右下角小窗">小窗</button>
      <button
        v-else
        class="video-btn"
        @click="mode = 'center'"
        title="回到居中显示">居中</button>
      <button class="video-btn" @click="toggleFullscreen" :title="isFullscreen ? '退出全屏' : '全屏'">
        {{ isFullscreen ? '退出全屏' : '全屏' }}
      </button>
      <button class="video-btn video-close" @click="$emit('close')" title="关闭">✕</button>
    </div>
    <video
      ref="video"
      :src="currentSrc"
      controls
      autoplay
      playsinline
      webkit-playsinline
      x5-video-player-type="h5"
      x5-playsinline
      preload="auto"
      @error="onError"></video>
    <div v-if="transcoding" class="video-transcoding">
      正在转码，请稍候…任何格式都能播，转好就自动开始放。
    </div>
    <div v-if="hasError" class="video-error">
      <span v-if="transcodeFailed">
        转码失败，此文件可能已损坏，请<a :href="src" download>下载后观看</a>，或<button class="video-retry" @click="startTranscode(true)">重试转码</button>。
      </span>
      <span v-else>
        此格式浏览器无法直接播放，请<a :href="src" download>下载后观看</a>。
      </span>
    </div>
  </div>
</template>

<script>
// 站内视频播放器（与音频播放器同款挂载方式）：
// - 挂在 App 根级，不随文件夹切换卸载；打开时不压历史，
//   因此网页前进/后退只换文件夹，绝不中断播放；
// - 默认居中显示（不遮罩，仍可翻文件夹、视频不会停），
//   点“小窗”缩到右下角，点“居中”回到居中；全屏与两种
//   形态正交，退出全屏回到切换前的形态；
// - 整页刷新或进 /admin 仍会中断（文档重载边界，与音频一致）；
// - 同一时间只播一种媒体：打开视频会关掉音频条，打开音频会关掉视频。
export default {
  props: {
    src: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      default: '',
    },
    // R2 里的源文件 key（App 传入）；转码请求用它，不从 URL 反推。
    sourceKey: {
      type: String,
      default: '',
    },
  },

  emits: ['close'],

  data() {
    return {
      // center：居中大窗（默认）；mini：右下角小窗。
      mode: 'center',
      isFullscreen: false,
      hasError: false,
      // 实际在播的地址：初始为原片，转码就绪后切到转码版。
      currentSrc: this.src,
      // 转码轮询中；转码版也播错时不再循环回转码。
      transcoding: false,
      transcodeFailed: false,
      transcodeTried: false,
      transcodeTimer: null,
    };
  },

  watch: {
    // 切到另一个视频时复位错误与转码态（此前旧态会残留到新视频）。
    src(newSrc) {
      this.stopTranscodePoll();
      this.hasError = false;
      this.transcoding = false;
      this.transcodeFailed = false;
      this.transcodeTried = false;
      this.currentSrc = newSrc;
    },
  },

  mounted() {
    document.addEventListener('fullscreenchange', this.onFullscreenChange);
    document.addEventListener('webkitfullscreenchange', this.onFullscreenChange);
  },

  beforeUnmount() {
    document.removeEventListener('fullscreenchange', this.onFullscreenChange);
    document.removeEventListener('webkitfullscreenchange', this.onFullscreenChange);
    this.stopTranscodePoll();
    // 关闭时若正处全屏，先退出，避免关窗后屏幕还停在全屏态。
    if (this.isFullscreen && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
  },

  methods: {
    onFullscreenChange() {
      this.isFullscreen = !!(
        document.fullscreenElement || document.webkitFullscreenElement
      );
    },

    toggleFullscreen() {
      if (this.isFullscreen) {
        const exit =
          document.exitFullscreen || document.webkitExitFullscreen;
        if (exit) exit.call(document).catch(() => {});
        return;
      }
      const box = this.$refs.box;
      const video = this.$refs.video;
      const request =
        (box && (box.requestFullscreen || box.webkitRequestFullscreen)) ||
        null;
      if (request) {
        request.call(box).catch(() => {});
      } else if (video && video.webkitEnterFullscreen) {
        // iOS Safari 不支持任意元素全屏，退回视频原生全屏。
        video.webkitEnterFullscreen();
      }
    },

    onError() {
      // 转码版也播错，或轮询中再次报错：不再循环，直接显示失败。
      if (this.transcoding || this.transcodeTried) {
        this.transcoding = false;
        this.hasError = true;
        return;
      }
      // 原片播错：任何格式都要能在站内播，自动走转码，不给死路。
      if (this.sourceKey) {
        this.startTranscode(false);
      } else {
        this.hasError = true;
      }
    },

    transcodeUrl(retry) {
      const key = this.sourceKey
        .split('/')
        .map(encodeURIComponent)
        .join('/');
      return `/transcode/${key}${retry ? '?retry=1' : ''}`;
    },

    startTranscode(retry) {
      this.stopTranscodePoll();
      this.transcoding = true;
      this.transcodeFailed = false;
      this.hasError = false;
      this.transcodeTried = true;
      this.pollTranscode(retry);
    },

    stopTranscodePoll() {
      if (this.transcodeTimer) {
        clearTimeout(this.transcodeTimer);
        this.transcodeTimer = null;
      }
    },

    async pollTranscode(retry) {
      try {
        const res = await fetch(this.transcodeUrl(retry), {
          headers: { Range: 'bytes=0-0' },
        });
        const type = res.headers.get('Content-Type') || '';
        if (type.startsWith('video/')) {
          // 转码版已就绪：切过去直接播。
          this.transcoding = false;
          this.currentSrc = this.transcodeUrl(false);
          this.$nextTick(() => {
            const video = this.$refs.video;
            if (video) video.play().catch(() => {});
          });
          return;
        }
        if (res.status === 401 || res.status === 403) {
          // 登录态丢了（受保护文件）：转码也拿不到，显示原失败。
          this.transcoding = false;
          this.hasError = true;
          return;
        }
        if (res.status === 200) {
          let body = null;
          try {
            body = await res.json();
          } catch (e) {
            // 非 JSON 的 200：继续轮询。
          }
          if (body && body.status === 'failed') {
            this.transcoding = false;
            this.transcodeFailed = true;
            this.hasError = true;
            return;
          }
        }
        // 202 排队中，或其他瞬时响应：继续轮询，关窗即停。
        this.transcodeTimer = setTimeout(
          () => this.pollTranscode(false),
          5000
        );
      } catch (e) {
        // 轮询中网络抖动：继续轮询，关窗即停。
        this.transcodeTimer = setTimeout(
          () => this.pollTranscode(false),
          5000
        );
      }
    },
  },
};
</script>

<style>
.video-player {
  position: fixed;
  z-index: 95;
  display: flex;
  flex-direction: column;
  background: #000;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.45);
  font-family: '寒蝉半圆体', -apple-system, BlinkMacSystemFont, 'Segoe UI Adjusted',
    'Segoe UI', 'Liberation Sans', sans-serif;
}

/* 居中大窗（默认）：宽受视口高约束，保证整窗在任何屏幕内放得下。
   注意：不要用 transform 居中——iOS 上 transform 祖先会让 <video>
   无法内联播放、退到原生播放器（看起来像跳出网站）。
   改用 inset + margin:auto，不用 transform 也能居中。 */
.video-player.center {
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  margin: auto;
  height: fit-content;
  width: min(960px, 92vw, calc((100vh - 60px) * 16 / 9));
  width: min(960px, 92vw, calc((100dvh - 60px) * 16 / 9));
}

/* 右下角小窗。 */
.video-player.mini {
  right: 12px;
  bottom: 12px;
  width: min(360px, calc(100vw - 24px));
}

/* 手机上小窗必须真小：之前 360px 在 390px 屏上和居中一样大，
   点“小窗”只是把同样大的窗移到底部而已。 */
@media (max-width: 480px) {
  .video-player.mini {
    width: min(200px, calc(100vw - 24px));
  }

  .video-player.mini .video-btn {
    padding: 3px 8px;
    font-size: 12px;
  }

  .video-player.mini .video-name {
    font-size: 13px;
  }
}

.video-player:fullscreen,
.video-player:-webkit-full-screen {
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  margin: 0;
  width: 100%;
  height: 100%;
  border-radius: 0;
}

.video-head {
  flex: none;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  background: rgba(20, 20, 20, 0.95);
}

.video-name {
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 14px;
  color: #fff;
}

.video-btn {
  flex: none;
  padding: 4px 12px;
  font-size: 13px;
  color: #fff;
  background: rgba(255, 255, 255, 0.14);
  border: none;
  border-radius: 50px;
  cursor: pointer;
}

.video-player video {
  display: block;
  width: 100%;
  aspect-ratio: 16 / 9;
  background: #000;
}

.video-player:fullscreen video,
.video-player:-webkit-full-screen video {
  flex: 1;
  min-height: 0;
  aspect-ratio: auto;
}

.video-error {
  padding: 10px 12px;
  font-size: 13px;
  color: #ffb4b4;
  background: #1a1a1a;
}

.video-error a {
  color: #7fd4dc;
}

.video-transcoding {
  padding: 10px 12px;
  font-size: 13px;
  color: #7fd4dc;
  background: #1a1a1a;
}

.video-retry {
  padding: 0;
  font: inherit;
  color: #7fd4dc;
  background: none;
  border: none;
  text-decoration: underline;
  cursor: pointer;
}
</style>
