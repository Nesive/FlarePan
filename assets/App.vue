<template>
  <AdminView v-if="isAdminPage" />
  <div v-else class="main" 
      @dragenter.prevent 
      @dragover.prevent 
      :style="{ backgroundImage: `url('${backgroundImageUrl}')`, paddingBottom: playerQueue.length ? '76px' : '' }"
  >
    <div class="app-bar">
      <a
        class="app-title-container"
        style="display: flex; align-items: center;"
        href="/"
        @click.prevent="cwd = ''">
        <img
          src="/assets/homescreen.png"
          alt="Nesive的网盘"
          style="height: 24px" />
        <h1 class="app-title" style="font-size: 20px;margin: 0 25px 0 8px; user-select: none;">FlareDrive</h1>
      </a>

      <input
        type="search"
        v-model="search"
        aria-label="Search"
        placeholder="🍿 输入以全局搜索文件" />
      <div class="menu-button">
        <button class="circle" @click="showMenu = true" style="display: flex; align-items: center;background-color: rgb(245, 245, 245);">
          <p style="
              white-space: nowrap;
              margin: 0 10px 0 0;
              font-size: 16px;
              font-family: '寒蝉半圆体', -apple-system, BlinkMacSystemFont, 'Segoe UI Adjusted',
    'Segoe UI', 'Liberation Sans', sans-serif;"
              class="menu-button-text">
            菜单
          </p>
          <svg
            t="1741761597964"
            class="icon"
            viewBox="0 0 1024 1024"
            version="1.1"
            xmlns="http://www.w3.org/2000/svg"
            p-id="22027" width="24" height="24">
            <path
              d="M365 663.5v210.7c0 18.6-23.4 26.8-35 12.3L131.2 637.9c-13.3-16.6-1.5-41.1 19.8-41.1h80.7v-400c0-36.8 29.8-66.7 66.7-66.7 36.8 0 66.7 29.8 66.7 66.7v466.7h-0.1z m200-466.7h266.7c36.8 0 66.7 29.8 66.7 66.7s-29.8 66.7-66.7 66.7H565c-36.8 0-66.7-29.8-66.7-66.7 0-36.8 29.9-66.7 66.7-66.7z m0 266.7h200c36.8 0 66.7 29.8 66.7 66.6s-29.8 66.7-66.6 66.7H565c-36.8 0-66.7-29.8-66.7-66.7 0.1-36.8 29.9-66.6 66.7-66.6z m0 266.7h133.3c36.8 0 66.7 29.8 66.7 66.7 0 36.8-29.8 66.7-66.7 66.7H565c-36.8 0-66.7-29.8-66.7-66.7 0.1-36.9 29.9-66.7 66.7-66.7z"
              p-id="22028" fill="#2c2c2c"></path>
          </svg>
        </button>
        <Menu v-model="showMenu"
          :items="[{ text: '按照名称排序A-Z' }, { text: '按照大小递增排序' }, { text: '按照大小递减排序' }]"
          @click="onMenuClick" />
      </div>
    </div>
    <div
      v-if="shareMode && shareState === 'loading'"
      style="margin: 20px 0; text-align: center">
      <span style="font-size: 20px;">加载中...</span>
    </div>
    <div
      v-else-if="shareMode && shareState === 'invalid'"
      style="margin: 20px 0; text-align: center">
      <span style="font-size: 20px;">分享不存在或已被撤销</span>
    </div>
    <div
      v-else-if="shareMode && shareState === 'expired'"
      style="margin: 20px 0; text-align: center">
      <span style="font-size: 20px;">分享已过期</span>
    </div>
    <div v-else-if="shareMode && shareState === 'code'" class="share-gate">
      <svg
        class="share-gate-icon"
        viewBox="0 0 24 24"
        width="56"
        height="56"
        fill="none"
        aria-hidden="true">
        <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" fill="rgba(57, 144, 155, 0.15)" stroke="rgb(57, 144, 155)" stroke-width="1.5" stroke-linejoin="round" />
      </svg>
      <div class="share-gate-title">受保护文件夹分享</div>
      <div class="share-gate-sub">请输入提取码查看分享内容</div>
      <div v-if="shareBusy" class="share-gate-wait">
        <span class="share-spinner"></span>
        <span>正在验证提取码…</span>
      </div>
      <div v-else>
        <input
          v-model="shareCode"
          maxlength="8"
          placeholder="提取码"
          @keyup.enter="submitShareCode"
          class="share-code-input" />
        <div><button @click="submitShareCode" class="share-enter-btn">进入</button></div>
        <div v-if="shareError" class="share-gate-error">{{ shareError }}</div>
      </div>
    </div>
    <div
      v-if="!shareMode || shareState === 'ready'"
      class="file-list-container">
      <ul class="file-list">
        <li v-if="cwd !== '' && (!shareMode || cwd !== shareRoot)">
          <div
            tabindex="0"
            class="file-item"
            @click="cwd = cwd.replace(/[^\/]+\/$/, '')"
            @contextmenu.prevent>
            <div class="file-icon">
              <svg  viewBox="0 0 576 512"
                xmlns="http://www.w3.org/2000/svg" width="36" height="36">
                <path d="M384 480l48 0c11.4 0 21.9-6 27.6-15.9l112-192c5.8-9.9 5.8-22.1 .1-32.1S555.5 224 544 224l-400 0c-11.4 0-21.9 6-27.6 15.9L48 357.1 48 96c0-8.8 7.2-16 16-16l117.5 0c4.2 0 8.3 1.7 11.3 4.7l26.5 26.5c21 21 49.5 32.8 79.2 32.8L416 144c8.8 0 16 7.2 16 16l0 32 48 0 0-32c0-35.3-28.7-64-64-64L298.5 96c-17 0-33.3-6.7-45.3-18.7L226.7 50.7c-12-12-28.3-18.7-45.3-18.7L64 32C28.7 32 0 60.7 0 96L0 416c0 35.3 28.7 64 64 64l23.7 0L384 480z"/>
              </svg>
            </div>
            <div class="file-info-container"><span class="file-name">返回上级目录</span></div>

          </div>
        </li>
        <li v-for="folder in filteredFolders" :key="folder">
          <div
            tabindex="0"
            class="file-item"
            @click="cwd = folder"
            @contextmenu.prevent="
            showContextMenu = true;
          focusedItem = folder;
          ">
            <div class="file-icon">
              <svg  viewBox="0 0 576 512"
                xmlns="http://www.w3.org/2000/svg" width="36" height="36">
                <path d="M384 480l48 0c11.4 0 21.9-6 27.6-15.9l112-192c5.8-9.9 5.8-22.1 .1-32.1S555.5 224 544 224l-400 0c-11.4 0-21.9 6-27.6 15.9L48 357.1 48 96c0-8.8 7.2-16 16-16l117.5 0c4.2 0 8.3 1.7 11.3 4.7l26.5 26.5c21 21 49.5 32.8 79.2 32.8L416 144c8.8 0 16 7.2 16 16l0 32 48 0 0-32c0-35.3-28.7-64-64-64L298.5 96c-17 0-33.3-6.7-45.3-18.7L226.7 50.7c-12-12-28.3-18.7-45.3-18.7L64 32C28.7 32 0 60.7 0 96L0 416c0 35.3 28.7 64 64 64l23.7 0L384 480z"/>
              </svg>
            </div>
            <div class="file-info-container"><span class="file-name" v-text="folder.match(/.*?([^/]*)\/?$/)[1]"></span>
            </div>
            <div
              v-if="!shareMode && siteShortlinkEnabled"
              style="margin-left: auto; margin-right: 10px;"
              @click.stop="copyShortLink(`/?p=${encodeURIComponent(folder)}`, 'folder:' + folder)" title="复制短链">
              <span style="font-size: 20px;">{{ copiedItem === 'folder:' + folder ? '✓' : '🔗' }}</span>
            </div>
            <div v-if="!shareMode" style="margin-right: 10px;" @click.stop="
              showContextMenu = true;
            focusedItem = folder;
            ">
              <svg
                t="1741761103305"
                class="icon"
                viewBox="0 0 1024 1024"
                version="1.1"
                xmlns="http://www.w3.org/2000/svg" p-id="6484" width="30" height="30">
                <path
                  d="M341.333333 533.333333a128 128 0 0 1 128 128v149.333334a128 128 0 0 1-128 128H192a128 128 0 0 1-128-128v-149.333334a128 128 0 0 1 128-128h149.333333z m469.333334 0a128 128 0 0 1 128 128v149.333334a128 128 0 0 1-128 128h-149.333334a128 128 0 0 1-128-128v-149.333334a128 128 0 0 1 128-128h149.333334z m-469.333334 64H192a64 64 0 0 0-63.893333 60.245334L128 661.333333v149.333334a64 64 0 0 0 60.245333 63.893333L192 874.666667h149.333333a64 64 0 0 0 63.893334-60.245334L405.333333 810.666667v-149.333334a64 64 0 0 0-60.245333-63.893333L341.333333 597.333333z m469.333334 0h-149.333334a64 64 0 0 0-63.893333 60.245334L597.333333 661.333333v149.333334a64 64 0 0 0 60.245334 63.893333L661.333333 874.666667h149.333334a64 64 0 0 0 63.893333-60.245334L874.666667 810.666667v-149.333334a64 64 0 0 0-60.245334-63.893333L810.666667 597.333333zM341.333333 64a128 128 0 0 1 128 128v149.333333a128 128 0 0 1-128 128H192a128 128 0 0 1-128-128V192a128 128 0 0 1 128-128h149.333333z m469.333334 0a128 128 0 0 1 128 128v149.333333a128 128 0 0 1-128 128h-149.333334a128 128 0 0 1-128-128V192a128 128 0 0 1 128-128h149.333334zM341.333333 128H192a64 64 0 0 0-63.893333 60.245333L128 192v149.333333a64 64 0 0 0 60.245333 63.893334L192 405.333333h149.333333a64 64 0 0 0 63.893334-60.245333L405.333333 341.333333V192a64 64 0 0 0-60.245333-63.893333L341.333333 128z m469.333334 0h-149.333334a64 64 0 0 0-63.893333 60.245333L597.333333 192v149.333333a64 64 0 0 0 60.245334 63.893334L661.333333 405.333333h149.333334a64 64 0 0 0 63.893333-60.245333L874.666667 341.333333V192a64 64 0 0 0-60.245334-63.893333L810.666667 128z"
                  fill="#2c2c2c" p-id="6485"></path>
              </svg>
            </div>
          </div>
        </li>
        <li v-for="file in filteredFiles" :key="file.key">
          <div @click="openFile(file)" @contextmenu.prevent="
            showContextMenu = true;
          focusedItem = file;" class="file-item" style="position: relative;">
            <MimeIcon
              :content-type="file.httpMetadata.contentType"
              :thumbnail="file.customMetadata.thumbnail
              ? `/raw/_$flaredrive$/thumbnails/${file.customMetadata.thumbnail}.png`
              : null
              " />
            <div class="file-info-container">
              <div class="file-name" v-text="file.key.split('/').pop()"></div>
              <div class="file-attr">
                <span v-text="new Date(file.uploaded).toLocaleString()"></span>
                <span v-text="formatSize(file.size)"></span>
              </div>
            </div>
            <div
              v-if="!shareMode && siteShortlinkEnabled"
              style="margin-left: auto; margin-right: 10px;"
              @click.stop="copyShortLink('/raw/' + file.key.split('/').map(encodeURIComponent).join('/'), 'file:' + file.key)"
              title="复制短链">
              <span style="font-size: 20px;">{{ copiedItem === 'file:' + file.key ? '✓' : '🔗' }}</span>
            </div>
            <div v-if="!shareMode" style="margin-right: 10px;" @click.stop="
              showContextMenu = true;
            focusedItem = file;
            ">
              <svg
                t="1741761103305"
                class="icon"
                viewBox="0 0 1024 1024"
                version="1.1"
                xmlns="http://www.w3.org/2000/svg" p-id="6484" width="30" height="30">
                <path
                  d="M341.333333 533.333333a128 128 0 0 1 128 128v149.333334a128 128 0 0 1-128 128H192a128 128 0 0 1-128-128v-149.333334a128 128 0 0 1 128-128h149.333333z m469.333334 0a128 128 0 0 1 128 128v149.333334a128 128 0 0 1-128 128h-149.333334a128 128 0 0 1-128-128v-149.333334a128 128 0 0 1 128-128h149.333334z m-469.333334 64H192a64 64 0 0 0-63.893333 60.245334L128 661.333333v149.333334a64 64 0 0 0 60.245333 63.893333L192 874.666667h149.333333a64 64 0 0 0 63.893334-60.245334L405.333333 810.666667v-149.333334a64 64 0 0 0-60.245333-63.893333L341.333333 597.333333z m469.333334 0h-149.333334a64 64 0 0 0-63.893333 60.245334L597.333333 661.333333v149.333334a64 64 0 0 0 60.245334 63.893333L661.333333 874.666667h149.333334a64 64 0 0 0 63.893333-60.245334L874.666667 810.666667v-149.333334a64 64 0 0 0-60.245334-63.893333L810.666667 597.333333zM341.333333 64a128 128 0 0 1 128 128v149.333333a128 128 0 0 1-128 128H192a128 128 0 0 1-128-128V192a128 128 0 0 1 128-128h149.333333z m469.333334 0a128 128 0 0 1 128 128v149.333333a128 128 0 0 1-128 128h-149.333334a128 128 0 0 1-128-128V192a128 128 0 0 1 128-128h149.333334zM341.333333 128H192a64 64 0 0 0-63.893333 60.245333L128 192v149.333333a64 64 0 0 0 60.245333 63.893334L192 405.333333h149.333333a64 64 0 0 0 63.893334-60.245333L405.333333 341.333333V192a64 64 0 0 0-60.245333-63.893333L341.333333 128z m469.333334 0h-149.333334a64 64 0 0 0-63.893333 60.245333L597.333333 192v149.333333a64 64 0 0 0 60.245334 63.893334L661.333333 405.333333h149.333334a64 64 0 0 0 63.893333-60.245333L874.666667 341.333333V192a64 64 0 0 0-60.245334-63.893333L810.666667 128z"
                  fill="#2c2c2c" p-id="6485"></path>
              </svg>
            </div>
          </div>
        </li>
      </ul>
    </div>
    <div
      v-if="loading && (!shareMode || shareState === 'ready')"
      style="margin: 20px 0; text-align: center">
      <span style="font-size: 20px;">加载中...</span>
    </div>
    <div v-else-if="loadError === 'forbidden' && (!shareMode || shareState === 'ready')" style="margin: 20px 0; text-align: center">
      <span style="font-size: 20px;">该文件夹无权访问</span>
    </div>
    <div
      v-else-if="loadError && (!shareMode || shareState === 'ready')"
      style="margin: 20px 0; text-align: center">
      <span style="font-size: 20px;">加载失败，请稍后重试</span>
      <div style="margin-top: 10px;"><button @click="fetchFiles" style="padding: 8px 20px;">重试</button></div>
    </div>
    <div v-else-if="(!shareMode || shareState === 'ready') && !filteredFiles.length && !filteredFolders.length" style="margin: 20px 0; text-align: center">
      <span style="font-size: 20px;">没有文件</span>
    </div>
    <Dialog v-model="showContextMenu">
      <div
        style="height: 50px;display: flex; justify-content: center; align-items: center; padding:10px; background: #ddd; margin: 0 0 10px 0; border-radius: 8px;">
        <div
          v-text="focusedItem.key || focusedItem"
          class="contextmenu-filename"
          @click.stop.prevent
          style="height:20px;width: 100%; max-width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;"></div>
      </div>
      <ul v-if="typeof focusedItem === 'string'" class="contextmenu-list">
        <li>
          <button @click="copyLink(`/?p=${encodeURIComponent(focusedItem)}`)">
            <span>复制链接</span>
          </button>
        </li>
        <li v-if="siteShortlinkEnabled">
          <button @click="copyShortLink(`/?p=${encodeURIComponent(focusedItem)}`, 'folder:' + focusedItem)">
            <span>复制短链</span>
          </button>
        </li>
      </ul>
      <ul v-else class="contextmenu-list">
        <li>
          <!-- 注意：不要加 target="_blank"：iOS 会忽略 download 并在新标签页打开文件。 -->
          <a :href="`/raw/${focusedItem.key}`" download>
            <span>下载</span>
          </a>
        </li>
        <li>
          <button @click="copyLink(`/raw/${focusedItem.key}`)">
            <span>复制链接</span>
          </button>
        </li>
        <li v-if="siteShortlinkEnabled">
          <button @click="copyShortLink('/raw/' + focusedItem.key.split('/').map(encodeURIComponent).join('/'), 'file:' + focusedItem.key)">
            <span>复制短链</span>
          </button>
        </li>
      </ul>
    </Dialog>
    <div style="flex:1"></div>
    <Footer />
    <AudioPlayer
      v-if="playerQueue.length"
      :queue="playerQueue"
      :start-index="playerStartIndex"
      @ended="playerQueue = []"
      @close="playerQueue = []" />
    <VideoPlayer
      v-if="videoUrl"
      :src="videoUrl"
      :name="videoName"
      :source-key="videoKey"
      @close="closeVideo" />
    <PdfPreview
      v-if="pdfUrl"
      :url="pdfUrl"
      :name="pdfName"
      :renderer="pdfRenderer"
      :player-visible="!!playerQueue.length"
      @close="closePdf" />
    <TextPreview
      v-if="textUrl"
      :url="textUrl"
      :name="textName"
      :is-markdown="textIsMarkdown"
      :size="textSize"
      :player-visible="!!playerQueue.length"
      @close="closeText" />
    <ImagePreview
      v-if="imageList.length"
      :images="imageList"
      :index="imageIndex"
      @close="closeImage" />
    <InfoPreview
      v-if="infoFile"
      :file="infoFile"
      @close="closeInfo" />
    <Dialog v-model="showAudioPrompt">
      <div class="audio-prompt">
        <div class="audio-prompt-title">播放音频</div>
        <div class="audio-prompt-name">{{ pendingAudio ? pendingAudio.key.split('/').pop() : '' }}</div>
        <div class="audio-prompt-text">是否播放当前文件夹中的所有音频？</div>
        <div class="audio-prompt-btns">
          <button class="audio-prompt-primary" @click="confirmAudioPlay(true)">播放全部</button>
          <button @click="confirmAudioPlay(false)">只播放这一首</button>
          <button @click="showAudioPrompt = false">取消</button>
        </div>
      </div>
    </Dialog>
  </div>
</template>

<script>
import {
  blobDigest,
  generateThumbnail,
  multipartUpload,
  SIZE_LIMIT,
} from '/assets/main.mjs';
import Dialog from './Dialog.vue';
import Menu from './Menu.vue';
import MimeIcon from './MimeIcon.vue';
import Footer from './Footer.vue';
import AudioPlayer from './AudioPlayer.vue';
import PdfPreview from './PdfPreview.vue';
import VideoPlayer from './VideoPlayer.vue';
import TextPreview from './TextPreview.vue';
import ImagePreview from './ImagePreview.vue';
import InfoPreview from './InfoPreview.vue';
import Admin from './Admin.vue';

// 路径归一：去掉尾部多余斜杠。短链目标曾多带一个 "/"（见 shorten 归一化），
// 浏览器据此请求的列表地址以 "//" 结尾，Pages 路由不到函数而回静态 404，
// 前端便显示“加载失败”。根目录（"" 或全斜杠）归一为空串。
function normalizeCwd(p) {
  return (p || '').replace(/\/+$/, '');
}

export default {
  data: () => ({
    cwd: normalizeCwd(new URL(window.location).searchParams.get('p') || ''),
    files: [],
    folders: [],
    focusedItem: null,
    loading: false,
    order: null,
    search: '',
    showContextMenu: false,
    showMenu: false,
    backgroundImageUrl: '/assets/bg-light.webp',
    copiedItem: null,
    loadError: '',
    // 分享模式：/s/<slug> 或 ?s=<slug> 进入；未验码前不拉任何文件列表。
    shareSlug: (() => {
      const m = window.location.pathname.match(/^\/s\/([^/]+)$/);
      if (m) return m[1];
      return new URL(window.location).searchParams.get('s') || '';
    })(),
    shareState: '',
    shareCode: '',
    shareError: '',
    shareBusy: false,
    shareRoot: '',
    // 前端版本戳：每次部署同步 bump（见 assets/version.json）。
    // 手机浏览器常把标签页留存数日不刷新，旧代码会让视频继续走新标签页；
    // 已加载的旧页在切回可见时发现版本不一致就自动重载，之后不再有旧代码。
    appVersion: '20261104-09',
    // 播放器挂在 App 根节点，文件夹切换、前进后退、PDF 浮层都不卸载它。
    playerQueue: [],
    playerStartIndex: 0,
    pendingAudio: null,
    showAudioPrompt: false,
    // 站内视频播放：默认居中大窗，可切右下角小窗；不压历史，不碰音频条以外的状态。
    videoUrl: '',
    videoName: '',
    // 短链总开关：公开配置 /api/site-config 的 shortlink_enabled 决定；
    // 取不到时默认开启（与旧行为一致），开关关闭时全部短链入口隐藏。
    siteShortlinkEnabled: true,
    // 转码用源文件 key（VideoPlayer 播错时凭它请求 /transcode/）。
    videoKey: '',
    // 站内 PDF 预览：浮层，不走新标签页，不碰播放器。
    // 渲染分窄屏/桌面两路：窄屏用 pdf.js 画布（贴合页宽由我们自己算，
    // 手机浏览器内嵌查看器在 iframe 里不保证贴合，见 PdfPreview），
    // 桌面用浏览器自带查看器。
    pdfUrl: '',
    pdfName: '',
    pdfRenderer: 'iframe',
    // 站内文本 / Markdown 查看器（见 TextPreview）。
    textUrl: '',
    textName: '',
    textIsMarkdown: false,
    textSize: 0,
    // 站内图片灯箱：同一文件夹的图片可切换。
    imageList: [],
    imageIndex: 0,
    // 兜底卡片：无专属查看器的格式点开落到这里，站内给下载。
    infoFile: null,
  }),

  computed: {
    isAdminPage() {
      const p = window.location.pathname;
      return p === '/admin' || p.startsWith('/admin/');
    },

    shareMode() {
      return !!this.shareSlug;
    },

    filteredFiles() {
      let files = this.files;
      if (this.search) {
        files = files.filter((file) =>
          file.key.split('/').pop().includes(this.search)
        );
      }
      return files;
    },

    filteredFolders() {
      let folders = this.folders;
      if (this.search) {
        folders = folders.filter((folder) => folder.includes(this.search));
      }
      return folders;
    },
  },

  methods: {
    copyLink(link) {
      const url = new URL(link, window.location.origin);
      navigator.clipboard.writeText(url.toString());
    },

    async copyShortLink(target, itemKey) {
      if (!this.siteShortlinkEnabled) return;
      this.showContextMenu = false;
      try {
        const res = await fetch('/api/shorten', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ target }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          if (res.status === 401) {
            alert('复制短链失败：无权访问');
            return;
          }
          alert(data.error ? `复制短链失败：${data.error}` : '复制短链失败');
          return;
        }
        const shortLink = data.shortLink;
        try {
          await navigator.clipboard.writeText(shortLink);
          this.copiedItem = itemKey;
          setTimeout(() => {
            if (this.copiedItem === itemKey) this.copiedItem = null;
          }, 2000);
        } catch (e) {
          window.prompt('短链地址（请手动复制）：', shortLink);
        }
      } catch (e) {
        alert('复制短链失败');
      }
    },



    // 分享：先问公开信息接口（只回 valid/expired，不泄露前缀），
    // 有效才显示输码框；验码通过后服务端 Set-Cookie 授权，之后
    // 的列表与下载都凭该 Cookie。已验过码的浏览器在会话期内
    // 可直接用 sessionStorage 里的前缀续访，Cookie 失效时自动
    // 回落到输码框（服务端仍是最终判定）。
    async shareLoad() {
      if (!this.shareMode) return;
      this.shareState = 'loading';
      this.shareError = '';
      const saved = sessionStorage.getItem('share:' + this.shareSlug);
      if (saved && document.cookie.includes('fd_share_grant=')) {
        this.shareRoot = saved;
        this.shareState = 'ready';
        if (this.cwd !== saved) this.cwd = saved;
        else this.fetchFiles();
        return;
      }
      try {
        const res = await fetch(`/api/share/${encodeURIComponent(this.shareSlug)}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.valid) {
          this.shareState = data.expired ? 'expired' : 'invalid';
          return;
        }
        this.shareState = 'code';
        // 带码链接：URL 带 ?code= 时用同一 verify 接口自动提交一次；
        // 成功按正常流程进 ready，失败落回输码框并显示错误，绝不循环重试。
        // ?code= 保留在地址栏（这就是该链接的用途）。已验过码的浏览器
        // 走上面的 sessionStorage 快捷路径，不会重复提交。
        const urlCode = new URL(window.location).searchParams.get('code');
        if (urlCode) {
          this.shareCode = urlCode;
          await this.submitShareCode();
        }
      } catch (e) {
        this.shareState = 'invalid';
      }
    },

    async submitShareCode() {
      if (!this.shareCode) {
        this.shareError = '请输入提取码';
        return;
      }
      if (this.shareBusy) return;
      this.shareBusy = true;
      this.shareError = '';
      try {
        const res = await fetch('/api/share/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slug: this.shareSlug, code: this.shareCode }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.status === 401) {
          this.shareError = '提取码不正确';
          return;
        }
        if (res.status === 403) {
          this.shareError = '该分享已被锁定，请 15 分钟后再试';
          return;
        }
        if (res.status === 404) {
          this.shareState = 'invalid';
          return;
        }
        if (res.status === 429) {
          this.shareError = '请求过于频繁，请稍后再试';
          return;
        }
        if (!res.ok || !data.prefix) {
          this.shareError = '验证失败，请重试';
          return;
        }
        this.shareRoot = data.prefix;
        sessionStorage.setItem('share:' + this.shareSlug, data.prefix);
        this.shareCode = '';
        this.shareState = 'ready';
        if (this.cwd !== data.prefix) this.cwd = data.prefix;
        else this.fetchFiles();
      } catch (e) {
        this.shareError = '验证失败，请重试';
      } finally {
        this.shareBusy = false;
      }
    },

    fetchFiles() {
      if (this.isAdminPage) return;
      // 分享模式未验码前绝不拉列表（首屏 immediate watcher 也一样）。
      if (this.shareMode && this.shareState !== 'ready') return;
      this.files = [];
      this.folders = [];
      this.loading = true;
      this.loadError = '';
      fetch(`/api/children/${normalizeCwd(this.cwd)}`)
        .then(async (res) => {
          if (res.status === 401) {
            // 分享授权失效：回输码框，不显示“无权访问”。
            if (this.shareMode) {
              this.shareState = 'code';
              this.shareRoot = '';
              sessionStorage.removeItem('share:' + this.shareSlug);
              this.loadError = '';
              this.loading = false;
              return null;
            }
            this.loadError = 'forbidden';
            this.loading = false;
            return null;
          }
          if (!res.ok) {
            throw new Error('http_' + res.status);
          }
          let data;
          try {
            data = await res.json();
          } catch (e) {
            throw new Error('bad_json');
          }
          return data;
        })
        .then((files) => {
          if (!files) return;
          this.files = files.value || [];
          if (this.order) {
            this.files.sort((a, b) => {
              if (this.order === 'size') {
                return b.size - a.size;
              }
            });
          }
          this.folders = files.folders || [];
          this.loading = false;
        })
        .catch(() => {
          this.files = [];
          this.folders = [];
          this.loadError = 'failed';
          this.loading = false;
        });
    },

    formatSize(size) {
      const units = ['B', 'KB', 'MB', 'GB', 'TB'];
      let i = 0;
      while (size >= 1024) {
        size /= 1024;
        i++;
      }
      return `${size.toFixed(1)} ${units[i]}`;
    },


    onMenuClick(text) {
      switch (text) {
        case '按照名称排序A-Z':
          this.order = null;
          break;
        case '按照大小递增排序':
          this.order = '大小↑';
          break;
        case '按照大小递减排序':
          this.order = '大小↓';
          break;
      }
      this.files.sort((a, b) => {
        if (this.order === '大小↑') {
          return a.size - b.size;
        } else if (this.order === '大小↓') {
          return b.size - a.size;
        } else {
          return a.key.localeCompare(b.key);
        }
      });
    },


    // 旧标签页自救：只在创建与切回可见时查一次，不轮询；
    // 取不到 version.json（老部署）时什么都不做，绝不循环重载。
    checkAppVersion() {
      fetch('/assets/version.json', { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => {
          if (j && j.version && j.version !== this.appVersion) {
            window.location.reload();
          }
        })
        .catch(() => {});
    },

    // 文件点开分流：视频走站内小窗，音频走站内播放器，PDF 走站内浮层，
    // 图片走站内灯箱，文本 / Markdown 走站内阅读器，其余走站内兜底卡片；
    // 任何格式都不再新标签页打开。
    isVideoFile(file) {
      const ct = (file.httpMetadata && file.httpMetadata.contentType) || '';
      if (ct.startsWith('video/')) return true;
      // 注意 .ogg 仍归音频（既有行为），视频用 .ogv 区分。
      // 格式尽量放宽：只要是视频文件一律站内打开，绝不因未识别
      // 而 fallback 到新标签页；浏览器解不了的格式由播放器内报错 + 下载。
      return /\.(mp4|m4v|webm|ogv|mov|mkv|avi|wmv|flv|f4v|rm|rmvb|3gp|3g2|3gpp|asf|ts|mts|m2ts|vob|mpg|mpeg|mpe|divx|m3u8|wmx|wvx|asx|mpv|m2v|mp2v|mk3d|ogm|qt|amv|drc|fli|flc|viv|vivo|nsv|roq|smk|bik|avs|gvi|tod|wm)$/i.test(file.key);
    },

    isAudioFile(file) {
      const ct = (file.httpMetadata && file.httpMetadata.contentType) || '';
      if (ct.startsWith('audio/')) return true;
      return /\.(mp3|wav|ogg|oga|m4a|flac|aac|opus|weba)$/i.test(file.key);
    },

    isPdfFile(file) {
      const ct = (file.httpMetadata && file.httpMetadata.contentType) || '';
      if (ct === 'application/pdf') return true;
      return /\.pdf$/i.test(file.key);
    },

    isImageFile(file) {
      const ct = (file.httpMetadata && file.httpMetadata.contentType) || '';
      if (ct.startsWith('image/')) return true;
      return /\.(png|jpe?g|gif|webp|svg|bmp|avif|ico|tiff?)$/i.test(file.key);
    },

    isMarkdownFile(file) {
      return /\.(md|markdown)$/i.test(file.key);
    },

    isTextFile(file) {
      // .html 也走文本源查看：绝不 iframe 渲染用户 HTML（站内脚本注入风险）。
      return /\.(txt|md|markdown|json|json5|csv|tsv|log|xml|html|htm|css|js|mjs|cjs|ts|jsx|tsx|py|rb|go|rs|java|c|h|cpp|hpp|cc|cs|php|sh|bash|zsh|yml|yaml|toml|ini|conf|cfg|env|sql|diff|patch|tex|rst|adoc|text|srt|vtt)$/i.test(file.key);
    },

    openFile(file) {
      if (this.isVideoFile(file)) {
        this.openVideo(file);
        return;
      }
      if (this.isAudioFile(file)) {
        this.pendingAudio = file;
        this.showAudioPrompt = true;
        return;
      }
      if (this.isPdfFile(file)) {
        this.openPdf(file);
        return;
      }
      if (this.isImageFile(file)) {
        this.openImage(file);
        return;
      }
      if (this.isTextFile(file)) {
        this.openText(file);
        return;
      }
      this.openInfo(file);
    },

    openText(file) {
      this.closeVideo();
      this.closeImage();
      this.closeInfo();
      this.textName = file.key.split('/').pop();
      this.textIsMarkdown = this.isMarkdownFile(file);
      this.textSize = file.size || 0;
      this.textUrl = `/raw/${file.key}`;
    },

    closeText() {
      this.textUrl = '';
      this.textName = '';
      this.textIsMarkdown = false;
      this.textSize = 0;
    },

    openImage(file) {
      this.closeVideo();
      this.closeText();
      this.closeInfo();
      const images = this.files.filter((f) => this.isImageFile(f)).map((f) => ({
        key: f.key,
        name: f.key.split('/').pop(),
        url: `/raw/${f.key}`,
      }));
      let idx = images.findIndex((im) => im.key === file.key);
      if (idx < 0) {
        images.unshift({
          key: file.key,
          name: file.key.split('/').pop(),
          url: `/raw/${file.key}`,
        });
        idx = 0;
      }
      this.imageList = images;
      this.imageIndex = idx;
    },

    closeImage() {
      this.imageList = [];
      this.imageIndex = 0;
    },

    openInfo(file) {
      this.closeVideo();
      this.closeText();
      this.closeImage();
      this.infoFile = {
        key: file.key,
        name: file.key.split('/').pop(),
        sizeText: this.formatSize(file.size),
        type: (file.httpMetadata && file.httpMetadata.contentType) || '',
        url: `/raw/${file.key}`,
      };
    },

    closeInfo() {
      this.infoFile = null;
    },

    openVideo(file) {
      this.closeText();
      this.closeImage();
      this.closeInfo();
      this.videoName = file.key.split('/').pop();
      this.videoKey = file.key;
      // ?play=1 换缓存键：绕过浏览器里已有的旧 octet-stream 缓存条目
      // （同 PDF 案的 ?preview=1；服务器侧会按扩展名回真正的视频类型）。
      this.videoUrl = `/raw/${file.key}?play=1`;
      // 同一时间只播一种媒体：开视频即停音频条。
      this.playerQueue = [];
      // 刻意不压历史：前进/后退只换文件夹，绝不中断视频。
    },

    closeVideo() {
      this.videoUrl = '';
      this.videoName = '';
      this.videoKey = '';
    },

    confirmAudioPlay(playAll) {
      this.showAudioPrompt = false;
      const picked = this.pendingAudio;
      this.pendingAudio = null;
      if (!picked) return;
      const toItem = (f) => ({
        key: f.key,
        name: f.key.split('/').pop(),
        url: `/raw/${f.key}`,
      });
      let list;
      if (playAll) {
        // 当前文件夹（不过滤搜索词）的全部音频，按列表顺序排队。
        list = this.files.filter((f) => this.isAudioFile(f)).map(toItem);
        if (!list.length) list = [toItem(picked)];
      } else {
        list = [toItem(picked)];
      }
      let start = list.findIndex((t) => t.key === picked.key);
      if (start < 0) start = 0;
      this.playerQueue = list;
      this.playerStartIndex = start;
      // 同一时间只播一种媒体：开音频即关视频小窗。
      this.videoUrl = '';
      this.videoName = '';
      this.videoKey = '';
    },

    openPdf(file) {
      this.pdfName = file.key.split('/').pop();
      // 预览 URL 带 ?preview=1：换一个缓存键，绕过浏览器里已有的
      // 旧 octet-stream 缓存条目（2026-11-04 续案实测：只改响应头
      // 不够，旧缓存会让重试继续弹下载框；响应头侧同时加了 no-cache
      // 防以后再形成过期缓存）。
      // 窄屏（≤480px，与站内窄屏断点一致）不用 iframe，改走画布渲染：
      // 手机浏览器内嵌查看器在 iframe 里不贴合页宽（站内不行、
      // 新标签页却可以，2026-11-04 案），画布宽度由组件自己按容器算，
      // 在任何手机浏览器上都贴合；桌面继续用浏览器自带查看器。
      this.pdfRenderer = window.innerWidth <= 480 ? 'canvas' : 'iframe';
      this.pdfUrl = `/raw/${file.key}?preview=1`;
      // 压一条只带状态的历史：后退先关浮层，不动播放器；前进可再打开。
      window.history.pushState(
        { pdf: this.pdfUrl, name: this.pdfName }, '', window.location.href);
    },

    closePdf() {
      // 浮层是自己压的历史才用后退关；否则直接关（例如开浮层后又切了目录）。
      if (window.history.state && window.history.state.pdf) {
        window.history.back();
      } else {
        this.pdfUrl = '';
        this.pdfName = '';
      }
    },






    // 新增：递归获取目录下所有文件和子目录

  },

  watch: {
    cwd: {
      handler() {
        if (this.isAdminPage) return;
        this.fetchFiles();
        // 分享模式不写 ?p=：地址栏保持 /s/<slug>，前缀不进 URL。
        if (this.shareMode) return;
        const url = new URL(window.location);
        if ((url.searchParams.get('p') || '') !== this.cwd) {
          this.cwd
            ? url.searchParams.set('p', this.cwd)
            : url.searchParams.delete('p');
          window.history.pushState(null, '', url.toString());
        }
        document.title = this.cwd.replace(/.*\/(?!$)|\//g, '') === '/'
            ? 'Nesive的网盘文件库'
            :`${this.cwd.replace(/.*\/(?!$)|\//g, '') || '/' } - Nesive网盘文件库`;
      },
      immediate: true,
    },
  },

  created() {
    if (this.shareMode) this.shareLoad();
    // 短链总开关：开关关闭时全部短链入口隐藏（见 siteShortlinkEnabled）。
    fetch('/api/site-config')
      .then((res) => res.json())
      .then((data) => {
        if (data && typeof data.shortlink_enabled === 'boolean') {
          this.siteShortlinkEnabled = data.shortlink_enabled;
        }
      })
      .catch(() => {});
    // 版本自救：见 checkAppVersion（旧标签页切回可见时自动刷新到新代码）。
    this.checkAppVersion();
    this._onVisibilityChange = () => {
      if (!document.hidden) this.checkAppVersion();
    };
    document.addEventListener('visibilitychange', this._onVisibilityChange);
    window.addEventListener('popstate', (ev) => {
      if (this.shareMode) return;
      const searchParams = new URL(window.location).searchParams;
      if (searchParams.get('p') !== this.cwd)
        this.cwd = normalizeCwd(searchParams.get('p') || '');
      // PDF 浮层与历史联动：后退到无 pdf 状态关浮层，前进回到 pdf 状态再打开。
      const st = (ev.state || {});
      if (this.pdfUrl && !st.pdf) {
        this.pdfUrl = '';
        this.pdfName = '';
      } else if (!this.pdfUrl && st.pdf) {
        this.pdfUrl = st.pdf;
        this.pdfName = st.name || '';
        // 前进恢复时按当前宽度重算渲染路（横竖屏可能已变）。
        this.pdfRenderer = window.innerWidth <= 480 ? 'canvas' : 'iframe';
      }
    });
  },

  unmounted() {
    if (this._onVisibilityChange) {
      document.removeEventListener('visibilitychange', this._onVisibilityChange);
    }
  },

  components: {
    AdminView: Admin,
    Dialog,
    Menu,
    MimeIcon,
    Footer,
    AudioPlayer,
    PdfPreview,
    VideoPlayer,
    TextPreview,
    ImagePreview,
    InfoPreview,
  },
};
</script>

<style>
.main {
  display: flex;
  height: 100%;
  /* background-image: url(/assets/bg-light.webp); */
  background-size: cover;
  background-position: center;
  overflow-y: auto;
  flex-direction: column;
}

.app-bar {
  z-index: 2;
  position: sticky;
  top: 0;
  padding: 8px;
  background-color: white;
  display: flex;
}

@media (max-width: 400px) {
  .menu-button {
    margin: 0;
    padding: 0;
  }

  button.circle {
    padding: 0 8px;
  }
  .menu-button-text {
    display: none !important;
  }
}

@media (max-width: 340px) {
  .app-title-container {
    display: none !important;
  }
}

.menu-button {
  display: flex;
  position: relative;
  margin-left: 10px;
  padding: 0 10px;
}

.file-list-container {
  margin: 20px auto;
  padding: 10px;
  width: 60%;
  max-width: 95%;
  background: rgba(255, 255, 255, 0.5);
  backdrop-filter: blur(10px);
  border-radius: 12px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  transition: width 0.3s ease;
}

@media (max-width: 1280px) {
  .file-list-container {
    width: 768px;
    padding: 10px;
  }
}

.menu-button>button {
  transition: background-color 0.2s ease;
}

.menu-button>button:hover {
  background-color: rgb(212, 212, 212);
}

.menu {
  position: absolute;
  top: 100%;
  right: 0;
}

/* 分享输码区：与文件列表同款半透明面板 + 青色点缀 */
.share-gate {
  margin: 40px auto;
  padding: 28px 24px;
  width: 360px;
  max-width: calc(100% - 32px);
  text-align: center;
  background: rgba(255, 255, 255, 0.5);
  backdrop-filter: blur(10px);
  border-radius: 12px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}

.share-gate-icon {
  display: block;
  margin: 0 auto 4px;
}

.share-gate-title {
  font-size: 20px;
  margin-bottom: 6px;
}

.share-gate-sub {
  font-size: 14px;
  color: #555;
  margin-bottom: 20px;
}

.share-code-input {
  width: 220px;
  max-width: 100%;
  padding: 12px 16px;
  font-size: 20px;
  letter-spacing: 0.3em;
  text-indent: 0.3em;
  text-align: center;
  border: 1.5px solid rgba(57, 144, 155, 0.4);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.75);
  outline: none;
}

.share-code-input:focus {
  border-color: rgb(57, 144, 155);
  box-shadow: 0 0 0 3px rgba(57, 144, 155, 0.18);
}

.share-enter-btn {
  margin-top: 16px;
  padding: 10px 48px;
  font-size: 16px;
  color: #fff;
  background: rgb(57, 144, 155);
  border-radius: 50px;
  box-shadow: 2px 4px 6px rgba(0, 0, 0, 0.2);
}

.share-gate-error {
  margin-top: 14px;
  color: #c00;
  font-size: 14px;
}

.share-gate-wait {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 18px 0 6px;
  font-size: 15px;
  color: #555;
}

.share-spinner {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 2px solid rgba(57, 144, 155, 0.25);
  border-top-color: rgb(57, 144, 155);
  animation: share-spin 0.8s linear infinite;
}

@keyframes share-spin {
  to {
    transform: rotate(360deg);
  }
}

/* 音频点播提示框：与分享输码区同款半透明面板 + 青色点缀 */
.audio-prompt {
  padding: 12px 16px 16px;
  width: 340px;
  max-width: calc(100vw - 48px);
  text-align: center;
}

.audio-prompt-title {
  font-size: 18px;
  margin-bottom: 8px;
}

.audio-prompt-name {
  font-size: 14px;
  color: #555;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 12px;
}

.audio-prompt-text {
  font-size: 15px;
  margin-bottom: 18px;
}

.audio-prompt-btns {
  display: flex;
  gap: 10px;
  justify-content: center;
  flex-wrap: wrap;
}

.audio-prompt-btns button {
  padding: 9px 18px;
  font-size: 14px;
  border-radius: 50px;
  border: 1.5px solid rgba(57, 144, 155, 0.4);
  background: rgba(255, 255, 255, 0.75);
  color: rgb(57, 144, 155);
  cursor: pointer;
}

.audio-prompt-btns button.audio-prompt-primary {
  background: rgb(57, 144, 155);
  color: #fff;
  border-color: rgb(57, 144, 155);
}
</style>
