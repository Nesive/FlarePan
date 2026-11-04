<template>
  <div class="audio-player">
    <div v-if="showList" class="ap-list">
      <div
        v-for="(t, i) in queue"
        :key="t.key"
        class="ap-list-item"
        :class="{ active: i === currentIndex }"
        @click="playIndex(i)"
      >
        <span class="ap-list-state">{{ i === currentIndex ? (playing ? '▶' : '❚❚') : '' }}</span>
        <span class="ap-list-name">{{ t.name }}</span>
      </div>
    </div>
    <div class="ap-bar">
      <button class="ap-btn" @click="prev" title="上一首">⏮</button>
      <button class="ap-btn ap-play" @click="togglePlay" :title="playing ? '暂停' : '播放'">{{ playing ? '❚❚' : '▶' }}</button>
      <button class="ap-btn" @click="next" title="下一首">⏭</button>
      <div class="ap-track" @click="showList = !showList" title="播放列表">
        <span class="ap-name">{{ current ? current.name : '' }}</span>
        <span class="ap-count" v-if="queue.length > 1">{{ currentIndex + 1 }} / {{ queue.length }}</span>
      </div>
      <span class="ap-time">{{ formatTime(currentTime) }} / {{ formatTime(duration) }}</span>
      <input
        class="ap-progress"
        type="range"
        min="0"
        step="0.1"
        :max="duration || 0"
        :value="currentTime"
        @input="onSeek"
        aria-label="进度"
      />
      <span class="ap-volume">
        <span>🔊</span>
        <input
          class="ap-volume-range"
          type="range"
          min="0"
          max="100"
          :value="Math.round(volume * 100)"
          @input="onVolume"
          aria-label="音量"
        />
      </span>
      <button class="ap-btn" @click="showList = !showList" :title="showList ? '收起列表' : '播放列表'">☰</button>
      <button class="ap-btn" @click="$emit('close')" title="关闭播放器">✕</button>
      <audio
        ref="audio"
        preload="auto"
        @timeupdate="onTimeUpdate"
        @loadedmetadata="onLoadedMetadata"
        @ended="onEnded"
        @play="playing = true"
        @pause="playing = false"
        @error="onError"
      ></audio>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    queue: {
      type: Array,
      required: true,
    },
    startIndex: {
      type: Number,
      default: 0,
    },
  },

  emits: ['ended', 'close'],

  data: () => ({
    currentIndex: 0,
    playing: false,
    currentTime: 0,
    duration: 0,
    volume: 1,
    showList: false,
  }),

  computed: {
    current() {
      return this.queue[this.currentIndex] || null;
    },
  },

  watch: {
    // App 每次点播都传一个新 queue：切到新队列的起始曲并起播。
    // 组件本身不卸载，音频元素常驻，前进后退、开 PDF 都不影响它。
    queue() {
      this.currentIndex = this.startIndex || 0;
      this.$nextTick(() => this.loadCurrent(true));
    },
  },

  mounted() {
    this.currentIndex = this.startIndex || 0;
    this.setupMediaSession();
    this.loadCurrent(true);
  },

  beforeUnmount() {
    const a = this.$refs.audio;
    if (a) {
      a.pause();
      a.removeAttribute('src');
    }
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = null;
    }
  },

  methods: {
    formatTime(s) {
      if (!s || isNaN(s) || !isFinite(s)) return '0:00';
      const m = Math.floor(s / 60);
      const sec = Math.floor(s % 60);
      return m + ':' + (sec < 10 ? '0' + sec : sec);
    },

    loadCurrent(autoplay) {
      const a = this.$refs.audio;
      const t = this.current;
      if (!a || !t) return;
      if (a.getAttribute('src') !== t.url) {
        a.src = t.url;
        this.currentTime = 0;
        this.duration = 0;
      }
      this.updateMediaSession();
      if (autoplay) {
        const p = a.play();
        if (p && p.catch) {
          p.catch(() => {
            // 自动播放被浏览器拦下时保持暂停态，用户点播放键即可继续。
            this.playing = false;
          });
        }
      }
    },

    resume() {
      const a = this.$refs.audio;
      if (!a) return;
      const p = a.play();
      if (p && p.catch) p.catch(() => { this.playing = false; });
    },

    togglePlay() {
      const a = this.$refs.audio;
      if (!a) return;
      if (this.playing) a.pause();
      else this.resume();
    },

    playIndex(i) {
      if (i < 0 || i >= this.queue.length) return;
      this.currentIndex = i;
      this.$nextTick(() => this.loadCurrent(true));
    },

    next() {
      if (this.currentIndex < this.queue.length - 1) {
        this.playIndex(this.currentIndex + 1);
      }
    },

    prev() {
      if (this.currentIndex > 0) {
        this.playIndex(this.currentIndex - 1);
      } else {
        const a = this.$refs.audio;
        if (a) a.currentTime = 0;
      }
    },

    onEnded() {
      // 播完一首自动进下一首；整队播完通知 App 撤掉播放条（自动退出）。
      if (this.currentIndex < this.queue.length - 1) {
        this.playIndex(this.currentIndex + 1);
      } else {
        this.$emit('ended');
      }
    },

    onError() {
      // 坏文件不卡住队列：跳下一首；队尾出错同样视为播完退出。
      if (this.currentIndex < this.queue.length - 1) {
        this.playIndex(this.currentIndex + 1);
      } else {
        this.$emit('ended');
      }
    },

    onTimeUpdate() {
      const a = this.$refs.audio;
      if (a) this.currentTime = a.currentTime;
    },

    onLoadedMetadata() {
      const a = this.$refs.audio;
      if (a) this.duration = a.duration || 0;
    },

    onSeek(e) {
      const a = this.$refs.audio;
      const v = parseFloat(e.target.value);
      if (!a || isNaN(v)) return;
      a.currentTime = v;
      this.currentTime = v;
    },

    onVolume(e) {
      const a = this.$refs.audio;
      const v = parseFloat(e.target.value) / 100;
      if (isNaN(v)) return;
      this.volume = v;
      if (a) a.volume = v;
    },

    setupMediaSession() {
      if (!('mediaSession' in navigator)) return;
      navigator.mediaSession.setActionHandler('play', () => this.resume());
      navigator.mediaSession.setActionHandler('pause', () => {
        const a = this.$refs.audio;
        if (a) a.pause();
      });
      navigator.mediaSession.setActionHandler('previoustrack', () => this.prev());
      navigator.mediaSession.setActionHandler('nexttrack', () => this.next());
    },

    updateMediaSession() {
      if (!('mediaSession' in navigator)) return;
      const t = this.current;
      if (!t) return;
      navigator.mediaSession.metadata = new MediaMetadata({
        title: t.name,
        artist: 'Nesive网盘',
        album: '',
      });
    },
  },
};
</script>

<style>
.audio-player {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 100;
  font-family: '寒蝉半圆体', -apple-system, BlinkMacSystemFont, 'Segoe UI Adjusted',
    'Segoe UI', 'Liberation Sans', sans-serif;
}

.ap-list {
  max-height: 40vh;
  overflow-y: auto;
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(10px);
  border-top: 1px solid rgba(57, 144, 155, 0.25);
  box-shadow: 0 -2px 12px rgba(0, 0, 0, 0.08);
}

.ap-list-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  cursor: pointer;
  font-size: 14px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
}

.ap-list-item.active {
  color: rgb(57, 144, 155);
  font-weight: 600;
}

.ap-list-state {
  width: 20px;
  text-align: center;
  font-size: 12px;
}

.ap-list-name {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ap-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 64px;
  padding: 0 12px;
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(10px);
  border-top: 1px solid rgba(57, 144, 155, 0.3);
  box-shadow: 0 -2px 12px rgba(0, 0, 0, 0.1);
}

.ap-btn {
  flex: none;
  width: 36px;
  height: 36px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: rgba(57, 144, 155, 0.12);
  color: rgb(57, 144, 155);
  font-size: 16px;
  cursor: pointer;
}

.ap-play {
  width: 44px;
  height: 44px;
  font-size: 18px;
  background: rgb(57, 144, 155);
  color: #fff;
}

.ap-track {
  flex: none;
  min-width: 0;
  max-width: 32%;
  cursor: pointer;
}

.ap-name {
  display: block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 14px;
}

.ap-count {
  font-size: 12px;
  color: #888;
}

.ap-time {
  flex: none;
  font-size: 12px;
  color: #666;
  white-space: nowrap;
}

.ap-progress {
  flex: 1;
  min-width: 60px;
  accent-color: rgb(57, 144, 155);
  cursor: pointer;
}

.ap-volume {
  flex: none;
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 14px;
}

.ap-volume-range {
  width: 80px;
  accent-color: rgb(57, 144, 155);
  cursor: pointer;
}

@media (max-width: 480px) {
  .ap-volume {
    display: none;
  }

  .ap-track {
    max-width: 40%;
  }

  .ap-time {
    display: none;
  }

  .ap-bar {
    gap: 6px;
    padding: 0 8px;
  }
}
</style>
