<template>
  <AdminView v-if="isAdminPage" />
  <div v-else class="main"
      ref="mainScroll"
      @dragenter.prevent
      @dragover.prevent
      @touchstart="onPtrTouchStart"
      @touchmove="onPtrTouchMove"
      @touchend="onPtrTouchEnd"
      @touchcancel="onPtrTouchEnd"
      :style="{ backgroundImage: isStarship ? undefined : `url('${backgroundImageUrl}')`, paddingBottom: playerQueue.length ? '76px' : '' }"
  >
    <div
      class="ptr-indicator"
      :class="{ 'ptr-pulling': ptrState === 'pulling' }"
      :style="{ height: ptrHeight + 'px' }"
      aria-hidden="true">
      <span v-if="ptrState === 'refreshing'" class="ptr-spinner"></span>
      <span class="ptr-text">{{ ptrLabel }}</span>
    </div>
<template v-if="isStarship">
    <div class="app-bar">
      <div class="hero">
        <svg class="hero-svg" viewBox="0 0 1200 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
          <defs>
            <radialGradient id="heroNebP" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stop-color="#7c3aed" stop-opacity="0.55"/><stop offset="100%" stop-color="#7c3aed" stop-opacity="0"/>
            </radialGradient>
            <radialGradient id="heroNebC" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stop-color="#00e5ff" stop-opacity="0.40"/><stop offset="100%" stop-color="#00e5ff" stop-opacity="0"/>
            </radialGradient>
            <radialGradient id="heroNebM" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stop-color="#ec4899" stop-opacity="0.28"/><stop offset="100%" stop-color="#ec4899" stop-opacity="0"/>
            </radialGradient>
            <radialGradient id="heroPlanet" cx="38%" cy="35%" r="75%">
              <stop offset="0%" stop-color="#a8c6ff"/><stop offset="45%" stop-color="#3b5bd6"/><stop offset="100%" stop-color="#141040"/>
            </radialGradient>
            <linearGradient id="heroRing" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stop-color="#00e5ff" stop-opacity="0.15"/><stop offset="50%" stop-color="#00e5ff" stop-opacity="0.95"/><stop offset="100%" stop-color="#a78bfa" stop-opacity="0.25"/>
            </linearGradient>
            <linearGradient id="heroShoot" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stop-color="#ffffff" stop-opacity="0"/><stop offset="100%" stop-color="#ffffff"/>
            </linearGradient>
            <filter id="heroBlur40" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="40"/></filter>
            <clipPath id="heroPlanetClip"><circle cx="920" cy="150" r="62"/></clipPath>
          </defs>
          <ellipse cx="250" cy="90" rx="280" ry="130" fill="url(#heroNebP)" filter="url(#heroBlur40)"/>
          <ellipse cx="1000" cy="230" rx="300" ry="140" fill="url(#heroNebC)" filter="url(#heroBlur40)"/>
          <ellipse cx="600" cy="40" rx="220" ry="90" fill="url(#heroNebM)" filter="url(#heroBlur40)"/>
          <g fill="#ffffff">
            <circle cx="120" cy="40" r="2" style="animation: twinkle 2.9s ease-in-out 0.6s infinite"/>
            <circle cx="300" cy="90" r="1.4" style="animation: twinkle 3.2s ease-in-out 1.4s infinite"/>
            <circle cx="470" cy="50" r="2" style="animation: twinkle 3.7s ease-in-out 1s infinite"/>
            <circle cx="640" cy="110" r="1.2" style="animation: twinkle 2.8s ease-in-out 2s infinite"/>
            <circle cx="780" cy="60" r="1.7" style="animation: twinkle 4.5s ease-in-out 0.5s infinite"/>
            <circle cx="180" cy="200" r="1.6" style="animation: twinkle 3.3s ease-in-out 2.5s infinite"/>
            <circle cx="420" cy="230" r="2" style="animation: twinkle 2.5s ease-in-out 1.2s infinite"/>
            <circle cx="560" cy="180" r="1.3" style="animation: twinkle 3.8s ease-in-out 0.8s infinite"/>
            <circle cx="700" cy="250" r="1.5" style="animation: twinkle 3s ease-in-out 1.8s infinite"/>
            <circle cx="1080" cy="70" r="1.8" style="animation: twinkle 4s ease-in-out 2.2s infinite"/>
            <circle cx="1150" cy="200" r="1.4" style="animation: twinkle 2.6s ease-in-out 0.4s infinite"/>
            <circle cx="60" cy="140" r="1.8" style="animation: twinkle 4.4s ease-in-out 1.6s infinite"/>
          </g>
          <circle cx="920" cy="150" r="118" fill="none" stroke="#ffffff" stroke-opacity="0.15" stroke-dasharray="4 9"/>
          <ellipse cx="920" cy="150" rx="112" ry="26" fill="none" stroke="url(#heroRing)" stroke-width="10" opacity="0.55" transform="rotate(-18 920 150)"/>
          <circle cx="920" cy="150" r="62" fill="url(#heroPlanet)"/>
          <g clip-path="url(#heroPlanetClip)">
            <rect x="920" y="88" width="62" height="124" fill="#000000" opacity="0.35"/>
            <ellipse cx="900" cy="130" rx="32" ry="11" fill="#7dd3fc" opacity="0.25" transform="rotate(-18 900 130)"/>
          </g>
          <path d="M 1025.5 114.5 A 112 26 -18 0 0 814.5 185.5" fill="none" stroke="url(#heroRing)" stroke-width="10" opacity="0.9"/>
          <g transform="translate(1038 150)">
            <rect x="-13" y="-2.5" width="10" height="5" fill="#38bdf8"/>
            <rect x="3" y="-2.5" width="10" height="5" fill="#38bdf8"/>
            <rect x="-3.5" y="-4" width="7" height="8" rx="2" fill="#e6edf3"/>
            <circle cx="0" cy="0" r="2" fill="#f472b6"/>
          </g>
          <g>
            <line x1="180" y1="60" x2="260" y2="90" stroke="url(#heroShoot)" stroke-width="2.5" stroke-linecap="round"/>
            <circle cx="260" cy="90" r="2.5" fill="#ffffff"/>
          </g>
        </svg>
        <div class="brand">
          <a href="/" @click.prevent="goHome"><b>FLAREPAN</b></a>
          <div class="sub">INTERSTELLAR · 星际航行者</div>
          <div class="tag">自托管 · 开源 · 深空航行中</div>
        </div>
      </div>
    </div>
    <div class="ctrl">
      <div class="logo-chip">⌖</div>
      <label class="ctrl-search">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#8b949e" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
        <input
          type="search"
          v-model="search"
          aria-label="Search"
          placeholder="在星图中检索文件…" />
      </label>
    </div>
</template>
    <div v-else class="app-bar">
      <a
        class="app-title-container"
        style="display: flex; align-items: center;"
        href="/"
        @click.prevent="goHome">
        <img
          src="/assets/homescreen.png"
          alt="FlarePan"
          style="height: 24px" />
        <h1 class="app-title" style="font-size: 20px;margin: 0 25px 0 8px; user-select: none;">FlarePan</h1>
      </a>

      <input
        type="search"
        v-model="search"
        aria-label="Search"
        placeholder="🍿 输入以全局搜索文件" />
    </div>
    <div v-if="isStarship && (!shareMode || shareState === 'ready')" class="chart">
      <nav class="crumbs">
        <!-- 根级是当前地名纯文本（IA：位置切换已移到位置标签栏，
             面包屑只剩文件夹路径，不再是下拉）。 -->
        <span class="here">{{ crumbs[0].label }}</span>
        <span v-if="crumbs.length > 1" class="chev">▸</span>
        <template v-for="(c, i) in crumbs.slice(1)" :key="activeDriveMount ? 'drive-' + c.driveId : c.path">
          <a v-if="i < crumbs.length - 2" href="#" @click.prevent="crumbClick(c)">{{ c.label }}</a>
          <span v-else class="cur">{{ c.label }}</span>
          <span v-if="i < crumbs.length - 2" class="chev">▸</span>
        </template>
      </nav>
      <div class="ship"
        @mouseenter="showMountTip(activeLocationMount, $event.currentTarget)"
        @mouseleave="hideMountTip"
        @touchstart="onMountTipTouchStart(activeLocationMount, $event)"
        @touchend="onMountTipTouchEnd"
        @touchcancel="onMountTipTouchEnd">
        <span class="dot" :class="shipDotClass"></span><span class="lbl">{{ shipLabel }}</span>
        <span class="num">v{{ appVersion }}</span>
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
        <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" :fill="isStarship ? 'rgba(0, 229, 255, 0.15)' : 'rgba(57, 144, 155, 0.15)'" :stroke="isStarship ? '#00e5ff' : 'rgb(57, 144, 155)'" stroke-width="1.5" stroke-linejoin="round" />
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
      class="file-list-container"
      ref="listWrap"
      @dragenter="onMountDragEnter"
      @dragleave="onMountDragLeave"
      @dragover.prevent
      @drop="onMountDrop">
      <!-- 位置标签栏（IA）：[我的网盘] [挂载…] [+] [管理]，常驻渲染
           （零挂载时也显示“我的网盘”与“＋”，页面不显空）；
           点一下即切换位置（复用 switchLocation）。状态点复用
           已落地的那套（绿点自身闪烁、断连灰点不闪、悬停说明）。
           位置：面板顶部，两套皮肤共用（原皮肤没有面包屑行，
           星际皮肤的面包屑在 .chart 行里另有去处，见上）。 -->
      <div v-if="!shareMode" class="places">
        <div class="places-scroll" ref="placesScroll" @scroll="updatePlacesFade">
          <button class="chip" :class="{ on: !activeLocationMount }" @click="switchLocation('', '')">我的网盘</button>
          <button
            v-for="m in davMounts" :key="'dav-' + m.id" class="chip"
            :class="{ on: activeMountId === m.id }"
            @mouseenter="showMountTip(m, $event.currentTarget)"
            @mouseleave="hideMountTip"
            @touchstart="onMountTipTouchStart(m, $event)"
            @touchend="onMountTipTouchEnd"
            @touchcancel="onMountTipTouchEnd"
            @click="switchLocation(m.id, 'dav')">
            <span class="loc-dot" :class="mountDotClass(m)"></span>{{ m.name }}
          </button>
          <button
            v-for="m in driveMounts" :key="'drive-' + m.id" class="chip"
            :class="{ on: activeDriveMountId === m.id }"
            @mouseenter="showMountTip(m, $event.currentTarget)"
            @mouseleave="hideMountTip"
            @touchstart="onMountTipTouchStart(m, $event)"
            @touchend="onMountTipTouchEnd"
            @touchcancel="onMountTipTouchEnd"
            @click="switchLocation(m.id, 'drive')">
            <span class="loc-dot" :class="mountDotClass(m)"></span>{{ m.name }}
          </button>
          <button class="chip add" title="添加挂载" @click="openAddMount">＋</button>
        </div>
        <button v-if="davMounts.length || driveMounts.length" class="chip manage" @click="openMountManager">管理</button>
      </div>
      <!-- 列表头就是排序控件（IA）：点一列按该列排，再点反向；
           当前列带箭头。每位置的排序各自记忆（pan-sort:<place>）。 -->
      <div class="listhead">
        <button class="lh-name" :class="{ on: sortKey === 'name' }" @click="onSortHeader('name')">名称 <span class="arr">{{ sortArrow('name') }}</span></button>
        <button class="lh-size" :class="{ on: sortKey === 'size' }" @click="onSortHeader('size')">大小 <span class="arr">{{ sortArrow('size') }}</span></button>
        <button class="lh-date" :class="{ on: sortKey === 'date' }" @click="onSortHeader('date')">修改时间 <span class="arr">{{ sortArrow('date') }}</span></button>
        <!-- 挂载内新建入口（二阶段）：列表头右端液态玻璃「＋ 新建」钮，
             点开是玻璃下拉菜单（上传文件 / 新建文件夹）。只在挂载内渲染；
             桌面与手机同一套交互（手机上只剩 ＋ 圆钮）。 -->
        <div v-if="activeMount && !shareMode" class="create-wrap">
          <button class="create-btn" :class="{ open: showCreateMenu }" @click.stop="toggleCreateMenu" aria-haspopup="true" :aria-expanded="showCreateMenu ? 'true' : 'false'">
            <span class="plus"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 5v14M5 12h14" /></svg></span>
            <span class="lbl">新建</span>
          </button>
          <div class="create-menu" :class="{ open: showCreateMenu }" role="menu">
            <button role="menuitem" @click="pickCreate('upload')">
              <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4m0 0L7 9m5-5l5 5" /><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" /></svg>
              <span class="mi-text"><span class="mi-label">上传文件</span><span class="hint">传到当前文件夹</span></span>
            </button>
            <button role="menuitem" @click="pickCreate('mkdir')">
              <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" /><path d="M12 11v6M9 14h6" /></svg>
              <span class="mi-text"><span class="mi-label">新建文件夹</span><span class="hint">在当前文件夹内创建</span></span>
            </button>
          </div>
          <input ref="mountFileInput" type="file" multiple style="display:none" @change="onMountFilePicked" />
        </div>
      </div>
      <div v-if="dragOver && activeMount && !shareMode" class="mount-drop-mask">
        松手上传到当前文件夹<span v-if="dragFileCount"> · {{ dragFileCount }} 个文件</span>
      </div>
      <div v-if="navLoading" class="list-loading-bar"></div>
      <ul class="file-list">
        <li v-if="(cwd !== '' || (activeDriveMount && driveFolderId !== 'root')) && (!shareMode || cwd !== shareRoot)">
          <div
            tabindex="0"
            class="file-item"
            @click="onUpRowClick"
            @contextmenu.prevent>
            <div class="file-icon tile-up">
              <svg  viewBox="0 0 576 512"
                xmlns="http://www.w3.org/2000/svg" width="36" height="36">
                <path d="M384 480l48 0c11.4 0 21.9-6 27.6-15.9l112-192c5.8-9.9 5.8-22.1 .1-32.1S555.5 224 544 224l-400 0c-11.4 0-21.9 6-27.6 15.9L48 357.1 48 96c0-8.8 7.2-16 16-16l117.5 0c4.2 0 8.3 1.7 11.3 4.7l26.5 26.5c21 21 49.5 32.8 79.2 32.8L416 144c8.8 0 16 7.2 16 16l0 32 48 0 0-32c0-35.3-28.7-64-64-64L298.5 96c-17 0-33.3-6.7-45.3-18.7L226.7 50.7c-12-12-28.3-18.7-45.3-18.7L64 32C28.7 32 0 60.7 0 96L0 416c0 35.3 28.7 64 64 64l23.7 0L384 480z"/>
              </svg>
            </div>
            <div class="file-info-container"><span class="file-name">返回上级目录</span></div>

          </div>
        </li>
        <li v-for="folder in filteredFolders" :key="folderKey(folder)">
          <div
            tabindex="0"
            class="file-item"
            @click="onFolderClick(folder)"
            @contextmenu.prevent="onFolderContextMenu(folder)">
            <div class="file-icon tile-folder">
              <svg  viewBox="0 0 576 512"
                xmlns="http://www.w3.org/2000/svg" width="36" height="36">
                <path d="M384 480l48 0c11.4 0 21.9-6 27.6-15.9l112-192c5.8-9.9 5.8-22.1 .1-32.1S555.5 224 544 224l-400 0c-11.4 0-21.9 6-27.6 15.9L48 357.1 48 96c0-8.8 7.2-16 16-16l117.5 0c4.2 0 8.3 1.7 11.3 4.7l26.5 26.5c21 21 49.5 32.8 79.2 32.8L416 144c8.8 0 16 7.2 16 16l0 32 48 0 0-32c0-35.3-28.7-64-64-64L298.5 96c-17 0-33.3-6.7-45.3-18.7L226.7 50.7c-12-12-28.3-18.7-45.3-18.7L64 32C28.7 32 0 60.7 0 96L0 416c0 35.3 28.7 64 64 64l23.7 0L384 480z"/>
              </svg>
            </div>
            <div class="file-info-container"><span class="file-name" v-text="folderDisplayName(folder)"></span>
              <span v-if="activeMount" class="dav-badge">{{ activeMountName }}</span>
              <span v-if="activeDriveMount" class="dav-badge">Google Drive</span>
            </div>
            <div v-if="!shareMode && !isDriveFolderObj(folder)" style="margin-right: 10px;" class="iconbtn" @click.stop="
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
                  :fill="isStarship ? '#c9d1d9' : '#2c2c2c'" p-id="6485"></path>
              </svg>
            </div>
          </div>
        </li>
        <li v-for="file in filteredFiles" :key="file.key">
          <div @click="openFile(file)" @contextmenu.prevent="
            showContextMenu = true;
          focusedItem = file;" class="file-item" style="position: relative;">
            <MimeIcon
              :content-type="fileContentType(file)"
              :thumbnail="file.customMetadata && file.customMetadata.thumbnail
              ? `/raw/_$flaredrive$/thumbnails/${file.customMetadata.thumbnail}.png`
              : null
              " />
            <div class="file-info-container">
              <div class="file-name" v-text="fileDisplayName(file)"></div>
              <div class="file-attr">
                <span v-if="activeMount" class="dav-badge">{{ activeMountName }}</span>
                <span v-if="activeDriveMount" class="dav-badge">Google Drive</span>
                <span v-text="new Date(file.uploaded).toLocaleString()"></span>
                <span v-text="fileSizeText(file)"></span>
              </div>
            </div>
            <div v-if="!shareMode" style="margin-right: 10px;" class="iconbtn" @click.stop="
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
                  :fill="isStarship ? '#c9d1d9' : '#2c2c2c'" p-id="6485"></path>
              </svg>
            </div>
          </div>
        </li>
      </ul>
      <div v-if="activeDriveMount && driveNextPageToken" style="margin: 16px 0; text-align: center">
        <button @click="loadMoreDriveFiles" :disabled="driveLoadMoreBusy" class="voyager-retry" style="padding: 8px 20px;">{{ driveLoadMoreBusy ? '加载中…' : '加载更多' }}</button>
      </div>
    </div>
    <div
      v-if="loading && (!shareMode || shareState === 'ready')"
      class="voyager-state"
      style="margin: 20px 0; text-align: center">
      <span style="font-size: 20px;">加载中...</span>
    </div>
    <div v-else-if="loadError === 'forbidden' && (!shareMode || shareState === 'ready')" class="voyager-state" style="margin: 20px 0; text-align: center">
      <span style="font-size: 20px;">该文件夹无权访问</span>
      <div style="margin-top: 10px;"><button @click="openLoginModal(() => fetchFiles())" class="voyager-retry" style="padding: 8px 20px;">登录后查看</button></div>
    </div>
    <div
      v-else-if="loadError && (!shareMode || shareState === 'ready')"
      class="voyager-state"
      style="margin: 20px 0; text-align: center">
      <span style="font-size: 20px;">加载失败，请稍后重试</span>
      <div style="margin-top: 10px;"><button @click="fetchFiles" class="voyager-retry" style="padding: 8px 20px;">重试</button></div>
    </div>
    <div
      v-else-if="activeMount && mountLoadError && (!shareMode || shareState === 'ready')"
      class="voyager-state"
      style="margin: 20px 0; text-align: center">
      <span style="font-size: 20px;">{{ mountLoadError === 'auth' ? '用户名或密码错误' : '挂载加载失败，请稍后重试' }}</span>
      <div style="margin-top: 10px;">
        <button v-if="activeMount && !activeMount.rememberPassword" @click="openMountPassword(activeMount)" class="voyager-retry" style="padding: 8px 20px;">重新输入密码</button>
        <button @click="fetchFiles" class="voyager-retry" style="padding: 8px 20px;">重试</button>
      </div>
    </div>
    <div
      v-else-if="activeDriveMount && mountLoadError && (!shareMode || shareState === 'ready')"
      class="voyager-state"
      style="margin: 20px 0; text-align: center">
      <span style="font-size: 20px;">{{ driveLoadErrorText }}</span>
      <div style="margin-top: 10px;">
        <button v-if="mountLoadError === 'auth'" @click="reauthDriveMount(activeDriveMount)" class="voyager-retry" style="padding: 8px 20px;">重新授权</button>
        <button @click="fetchFiles" class="voyager-retry" style="padding: 8px 20px;">重试</button>
      </div>
    </div>
    <div v-else-if="(!shareMode || shareState === 'ready') && !filteredFiles.length && !filteredFolders.length" class="voyager-state" style="margin: 20px 0; text-align: center">
      <!-- 空态插画（内联 SVG，自包含不引外部图片）：敞开的文件夹 +
           漂浮的星点 + 虚线轨道，贴合星际主题；颜色走 currentColor，
           原始皮肤青色、星际皮肤荧光绿（见 skin-starship.css）。
           搜索无结果是放大镜变体；无挂载时文件夹右下角多个小加号。 -->
      <svg class="empty-state-art" viewBox="0 0 160 120" aria-hidden="true">
        <circle cx="48" cy="30" r="1.6" fill="currentColor" opacity="0.55" />
        <circle cx="120" cy="26" r="1.4" fill="currentColor" opacity="0.5" />
        <g v-if="emptyStateKind !== 'search'">
          <ellipse cx="80" cy="68" rx="70" ry="28" fill="none" stroke="currentColor" stroke-width="1" stroke-dasharray="2 6" opacity="0.4" />
          <path d="M38 64 a6 6 0 0 1 6-6 h16 l8 8 h48 a6 6 0 0 1 6 6 v32 a6 6 0 0 1-6 6 H44 a6 6 0 0 1-6-6 Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" />
          <path d="M62 30 l1.8 5 5 1.8 -5 1.8 -1.8 5 -1.8-5 -5-1.8 5-1.8 Z" fill="currentColor" />
          <path d="M86 18 l1.4 3.8 3.8 1.4 -3.8 1.4 -1.4 3.8 -1.4-3.8 -3.8-1.4 3.8-1.4 Z" fill="currentColor" opacity="0.8" />
          <path d="M104 34 l1.3 3.4 3.4 1.3 -3.4 1.3 -1.3 3.4 -1.3-3.4 -3.4-1.3 3.4-1.3 Z" fill="currentColor" opacity="0.7" />
          <g v-if="emptyStateKind === 'nomount'" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <circle cx="118" cy="104" r="10" />
            <path d="M118 99.5 v9 M113.5 104 h9" />
          </g>
        </g>
        <g v-if="emptyStateKind === 'search'">
          <circle cx="70" cy="60" r="24" fill="none" stroke="currentColor" stroke-width="2" />
          <line x1="88" y1="78" x2="106" y2="96" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
          <path d="M70 52 l1.6 4.4 4.4 1.6 -4.4 1.6 -1.6 4.4 -1.6-4.4 -4.4-1.6 4.4-1.6 Z" fill="currentColor" />
          <path d="M96 30 l1.3 3.4 3.4 1.3 -3.4 1.3 -1.3 3.4 -1.3-3.4 -3.4-1.3 3.4-1.3 Z" fill="currentColor" opacity="0.7" />
        </g>
      </svg>
      <div class="empty-state-text">{{ emptyStateText }}</div>
    </div>
    <Dialog v-model="showContextMenu">
      <div
        style="height: 50px;display: flex; justify-content: center; align-items: center; padding:10px; background: rgba(0,229,255,0.10); border: 1px solid rgba(255,255,255,0.14); margin: 0 0 10px 0; border-radius: 8px;">
        <div
          v-text="focusedItemName"
          class="contextmenu-filename"
          @click.stop.prevent
          style="height:20px;width: 100%; max-width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;"></div>
      </div>
      <ul v-if="typeof focusedItem === 'string'" class="contextmenu-list">
        <li v-if="activeMount">
          <button @click="copyMountPath(focusedItem)">
            <span>复制挂载内路径</span>
          </button>
        </li>
        <li v-if="activeMount">
          <button @click="openRenameDialog(focusedItem)">
            <span>重命名</span>
          </button>
        </li>
        <li v-if="activeMount">
          <button @click="openDeleteDialog(focusedItem)" class="dav-danger-text">
            <span>删除</span>
          </button>
        </li>
        <li v-else>
          <button @click="copyLink(`/?p=${encodeURIComponent(focusedItem)}`, 'folder:' + focusedItem)">
            <span>复制链接</span>
          </button>
        </li>
      </ul>
      <ul v-else class="contextmenu-list">
        <li>
          <!-- 预检后再下载：受保护文件未登录时弹站内登录框，而不是浏览器原生框。 -->
          <button @click="downloadFile(focusedItem)">
            <span>下载</span>
          </button>
        </li>
        <li v-if="activeMount">
          <button @click="copyMountPath(focusedItem)">
            <span>复制挂载内路径</span>
          </button>
        </li>
        <li v-if="activeMount">
          <button @click="openRenameDialog(focusedItem)">
            <span>重命名</span>
          </button>
        </li>
        <li v-if="activeMount">
          <button @click="openDeleteDialog(focusedItem)" class="dav-danger-text">
            <span>删除</span>
          </button>
        </li>
        <li v-else>
          <button @click="copyLink('/raw/' + focusedItem.key.split('/').map(encodeURIComponent).join('/'), 'file:' + focusedItem.key)">
            <span>复制链接</span>
          </button>
        </li>
      </ul>
    </Dialog>
    <!-- 挂载内写操作（二阶段） -->
    <Dialog :model-value="showMkdirDialog" @update:model-value="($event) => { if (!$event) showMkdirDialog = false; }">
      <div class="dav-write-dialog">
        <div class="dav-modal-title">新建文件夹</div>
        <label class="login-field"><span>文件夹名称</span>
          <input ref="mkdirInput" v-model="mkdirName" type="text" placeholder="文件夹名称" @keyup.enter="submitMkdir" />
        </label>
        <div v-if="mkdirError" class="login-modal-error">{{ mkdirError }}</div>
        <div class="dav-form-btns">
          <button class="login-modal-cancel" @click="showMkdirDialog = false">取消</button>
          <button class="login-modal-primary" @click="submitMkdir" :disabled="mkdirBusy">{{ mkdirBusy ? '创建中…' : '创建' }}</button>
        </div>
      </div>
    </Dialog>
    <Dialog :model-value="showRenameDialog" @update:model-value="($event) => { if (!$event) showRenameDialog = false; }">
      <div class="dav-write-dialog">
        <div class="dav-modal-title">重命名</div>
        <label class="login-field"><span>新名称</span>
          <input ref="renameInput" v-model="renameName" type="text" @keyup.enter="submitRename" />
        </label>
        <div v-if="renameError" class="login-modal-error">{{ renameError }}</div>
        <div class="dav-form-btns">
          <button class="login-modal-cancel" @click="showRenameDialog = false">取消</button>
          <button class="login-modal-primary" @click="submitRename" :disabled="renameBusy">{{ renameBusy ? '重命名中…' : '重命名' }}</button>
        </div>
      </div>
    </Dialog>
    <Dialog :model-value="showDeleteDialog" @update:model-value="($event) => { if (!$event) showDeleteDialog = false; }">
      <div class="dav-write-dialog">
        <div class="dav-modal-title">删除</div>
        <div class="dav-delete-text">{{ deleteText }}</div>
        <div class="dav-form-btns">
          <button class="login-modal-cancel" @click="showDeleteDialog = false">取消</button>
          <button class="login-modal-primary dav-danger-btn" @click="submitDelete" :disabled="deleteBusy">{{ deleteBusy ? '删除中…' : '删除' }}</button>
        </div>
      </div>
    </Dialog>
    <Dialog :model-value="!!uploadConflict" @update:model-value="($event) => { if (!$event) resolveUploadConflict('cancel'); }">
      <div class="dav-write-dialog" v-if="uploadConflict">
        <div class="dav-modal-title">已存在同名文件</div>
        <div class="dav-delete-text">「{{ uploadConflict.item.name }}」已存在，要怎么处理？</div>
        <label class="dav-check"><input type="checkbox" v-model="uploadConflict.applyToAll" /> 本次批量都这样处理</label>
        <div class="dav-form-btns">
          <button class="login-modal-cancel" @click="resolveUploadConflict('cancel')">取消</button>
          <button class="login-modal-cancel" @click="resolveUploadConflict('rename')">改名上传</button>
          <button class="login-modal-primary" @click="resolveUploadConflict('overwrite')">覆盖</button>
        </div>
      </div>
    </Dialog>
    <Dialog :model-value="!!textConflict" @update:model-value="($event) => { if (!$event) resolveTextConflict(false); }">
      <div class="dav-write-dialog" v-if="textConflict">
        <div class="dav-modal-title">文件已被改过</div>
        <div class="dav-delete-text">{{ textConflict.detail }}</div>
        <div class="dav-form-btns">
          <button class="login-modal-cancel" @click="resolveTextConflict(false)">{{ textConflict.discardLabel || '放弃我的修改，重新加载' }}</button>
          <button class="login-modal-primary" @click="resolveTextConflict(true)">{{ textConflict.overwriteLabel || '用我的版本覆盖' }}</button>
        </div>
      </div>
    </Dialog>
    <!-- 上传队列面板（二阶段）：固定底部，音频播放条上方。 -->
    <div v-if="mountUploads.length" class="mount-upload-panel" :style="{ bottom: playerQueue.length ? '76px' : '0' }">
      <div class="mount-upload-head">
        <span>{{ mountUploadSummary }}</span>
        <button class="mount-upload-hide" @click="clearFinishedUploads" title="清除已完成/已取消的行">清除已完成</button>
      </div>
      <ul class="mount-upload-list">
        <li v-for="u in mountUploads" :key="u.id" class="mount-upload-row">
          <span class="mount-upload-name" :title="u.name">{{ u.name }}</span>
          <span class="mount-upload-bar"><span :style="{ width: uploadPercent(u) + '%' }"></span></span>
          <span class="mount-upload-state">{{ uploadStateText(u) }}</span>
          <button v-if="u.status === 'failed'" class="mount-upload-retry" @click="retryMountUpload(u)">重试</button>
          <button v-if="u.status === 'uploading' || u.status === 'queued'" class="mount-upload-cancel" @click="cancelMountUpload(u)">取消</button>
        </li>
      </ul>
    </div>
    <div v-if="toastText" class="pan-toast">{{ toastText }}</div>
    <!-- 自定义状态提示（替代原生 title）：fixed 浮层，标题“显示名 · 状态”
         + 说明行；桌面悬停、手机长按 600ms 显示，点别处关闭。
         pointer-events:none，不挡住下面的点击。 -->
    <div v-if="mountTip.show" ref="mountTip" class="mount-tip" :style="{ left: mountTip.left + 'px', top: mountTip.top + 'px' }">
      <div class="mount-tip-title"><span class="loc-dot" :class="mountTip.dotClass"></span>{{ mountTip.title }}</div>
      <div class="mount-tip-detail">{{ mountTip.detail }}</div>
    </div>
    <Dialog :model-value="showManualCopy" @update:model-value="($event) => { if (!$event) closeManualCopy(); }">
      <div style="padding: 6px 4px 2px; font-size: 15px; font-weight: 600;">
        {{ manualCopyTitle }}
      </div>
      <input
        ref="manualCopyInput"
        :value="manualCopyText"
        readonly
        class="manual-copy-input"
        @focus="$event.target.select()"
        @click="$event.target.select()" />
      <div style="margin-top: 12px; text-align: right;">
        <button @click="closeManualCopy" class="voyager-retry" style="padding: 8px 20px;">关闭</button>
      </div>
      <div style="margin-top: 8px; font-size: 12px; color: #888;">
        长按 / 右键可手动复制上面整段地址。
      </div>
    </Dialog>
    <div style="flex:1"></div>
    <div v-if="isStarship" class="orbit">
      <div class="line l"></div>
      <svg class="planet" width="34" height="34" viewBox="0 0 80 80" aria-hidden="true">
        <circle cx="40" cy="40" r="11" fill="none" stroke="#00e5ff" stroke-width="2"/>
        <ellipse cx="40" cy="40" rx="26" ry="10" fill="none" stroke="#a78bfa" stroke-width="2" transform="rotate(-20 40 40)"/>
        <circle cx="40" cy="40" r="5" fill="#a78bfa"/>
      </svg>
      <div class="line r"></div>
    </div>
    <Footer />
    <AudioPlayer
      v-if="playerQueue.length"
      :queue="playerQueue"
      :skin="skin"
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
      :key="textKey"
      :url="textUrl"
      :name="textName"
      :is-markdown="textIsMarkdown"
      :size="textSize"
      :editable="textEditable"
      :saving="textSaving"
      :player-visible="!!playerQueue.length"
      @save="saveMountText"
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
    <Dialog :model-value="showLogin" @update:model-value="onLoginDialogToggle" class="login-dialog">
      <form class="login-modal" @submit.prevent="submitLogin">
        <div class="login-modal-title">管理员登录</div>
        <div class="login-modal-sub">该内容需要登录后查看</div>
        <label class="login-field">
          <span>账号</span>
          <input
            ref="loginUserInput"
            v-model="loginUser"
            type="text"
            placeholder="请输入管理员账号"
            autocomplete="username"
            :disabled="loginBusy" />
        </label>
        <label class="login-field">
          <span>密码</span>
          <input
            v-model="loginPass"
            type="password"
            placeholder="请输入密码"
            autocomplete="current-password"
            :disabled="loginBusy" />
        </label>
        <div v-if="loginError" class="login-modal-error">{{ loginError }}</div>
        <button type="submit" class="login-modal-primary" :disabled="loginBusy">
          {{ loginBusy ? '登录中…' : '登录' }}
        </button>
        <button type="button" class="login-modal-cancel" @click="closeLogin" :disabled="loginBusy">取消</button>
        <div class="login-modal-hint">没有账号？请使用分享链接并输入提取码进入。</div>
      </form>
    </Dialog>
    <Dialog :model-value="showMountManager" @update:model-value="($event) => { if (!$event) showMountManager = false; }">
      <div class="dav-manager">
        <div class="dav-modal-title">挂载管理</div>
        <div v-if="!davMounts.length && !driveMounts.length" class="dav-empty">
          <div>还没有挂载任何 WebDAV 服务</div>
          <div class="dav-empty-sub">挂载只存在本机浏览器，不会上传到 FlarePan 服务器。</div>
          <button class="login-modal-primary" @click="openAddMount">添加第一个挂载</button>
        </div>
        <ul v-if="davMounts.length || driveMounts.length" class="dav-mount-list">
          <li v-for="m in davMounts" :key="m.id" class="dav-mount-row"
            @mouseenter="showMountTip(m, $event.currentTarget)"
            @mouseleave="hideMountTip">
            <span class="loc-dot" :class="mountDotClass(m)"></span>
            <div class="dav-mount-info"
              @touchstart="onMountTipTouchStart(m, $event)"
              @touchend="onMountTipTouchEnd"
              @touchcancel="onMountTipTouchEnd">
              <div class="dav-mount-name">{{ m.name }}</div>
              <div class="dav-mount-url">{{ m.url }}</div>
              <div class="dav-mount-status">{{ mountStatusLine(m) }}</div>
              <div v-if="mountTestResults[m.id]" class="dav-mount-test">{{ mountTestResults[m.id] }}</div>
            </div>
            <div class="dav-mount-actions">
              <button @click="enterMount(m)">进入</button>
              <button @click="testMount(m)">测试</button>
              <button @click="openEditMount(m)">编辑</button>
              <button @click="openShareQr(m)">分享二维码</button>
              <button v-if="mountDeleteArmed !== m.id" @click="mountDeleteArmed = m.id" class="dav-danger">删除</button>
              <button v-else @click="deleteMount(m)" class="dav-danger">确认删除？</button>
            </div>
          </li>
          <li v-for="m in driveMounts" :key="m.id" class="dav-mount-row"
            @mouseenter="showMountTip(m, $event.currentTarget)"
            @mouseleave="hideMountTip">
            <span class="loc-dot" :class="mountDotClass(m)"></span>
            <div class="dav-mount-info"
              @touchstart="onMountTipTouchStart(m, $event)"
              @touchend="onMountTipTouchEnd"
              @touchcancel="onMountTipTouchEnd">
              <div class="dav-mount-name">{{ m.name }}</div>
              <div class="dav-mount-url">{{ m.accountEmail || 'Google Drive' }}</div>
              <div class="dav-mount-status">{{ mountStatusLine(m) }}</div>
              <div v-if="driveTestResults[m.id]" class="dav-mount-test">{{ driveTestResults[m.id] }}</div>
            </div>
            <div class="dav-mount-actions">
              <button @click="enterDriveMount(m)">进入</button>
              <button @click="testDriveMount(m)">测试</button>
              <button @click="reauthDriveMount(m)">重新授权</button>
              <button v-if="driveDeleteArmed !== m.id" @click="driveDeleteArmed = m.id" class="dav-danger">删除</button>
              <button v-else @click="deleteDriveMount(m)" class="dav-danger">确认删除？</button>
            </div>
          </li>
        </ul>
        <button v-if="davMounts.length || driveMounts.length" class="login-modal-primary" @click="openAddMount">+ 添加挂载</button>
        <div class="dav-privacy">配置与密码只保存在本机浏览器，不会上传到 FlarePan 服务器。换设备或清除浏览器数据后需重新添加。Google 授权信息与 refresh_token 同样只保存在本机浏览器；你也可以随时在 Google 账号 → 第三方访问权限里移除 FlarePan 的授权，移除后本机挂载立即失效。</div>
      </div>
    </Dialog>
    <Dialog :model-value="showAddMount" @update:model-value="onAddMountToggle">
      <div class="dav-add">
        <div class="dav-modal-title">{{ editingMountId ? '编辑挂载' : '添加挂载' }}</div>
        <div v-if="!editingMountId" class="dav-tabs">
          <button :class="{ on: addTab === 'scan' }" @click="switchAddTab('scan')">扫码添加</button>
          <button :class="{ on: addTab === 'manual' }" @click="switchAddTab('manual')">手动添加</button>
          <button v-if="driveProvider" :class="{ on: addTab === 'drive' }" @click="switchAddTab('drive')">Google Drive</button>
        </div>
        <div v-if="addTab === 'scan' && !editingMountId" class="dav-scan">
          <div class="dav-scan-hint">支持通用 URL 二维码与 FlarePan 二维码。猫头鹰文件分享二维码里的密码是加密的、不能直接登录，请改手动添加（密码用 Cloudreve 设置里的 WebDAV 密码）。</div>
          <div v-if="scanState !== 'scanning'" class="dav-scan-btns">
            <button class="login-modal-primary" @click="startScan">打开相机扫码</button>
            <button class="login-modal-cancel" @click="$refs.scanFileInput.click()">从相册选择</button>
            <input ref="scanFileInput" type="file" accept="image/*" style="display:none" @change="onScanFile" />
          </div>
          <div v-show="scanState === 'scanning'" class="dav-scan-box">
            <div id="dav-scan-reader"></div>
            <button class="login-modal-cancel" @click="stopScan">停止扫码</button>
          </div>
          <label class="login-field"><span>或粘贴二维码内容</span>
            <textarea v-model="scanPaste" class="dav-paste" placeholder="把二维码里的文字贴到这里，也能解析"></textarea>
          </label>
          <div style="margin-bottom: 12px;"><button class="login-modal-primary" @click="parsePastedQr">解析</button></div>
          <div v-if="scanError" class="login-modal-error">{{ scanError }}</div>
          <div v-if="scanState === 'parsed' && parsedMount" class="dav-parsed">
            <!-- 猫头鹰文件二维码：码里密码是加密串、登不上（2026-11-14
                 用户实测），不给“保存挂载并进入”——存了也是个坏挂载；
                 只展示解析出的地址与用户名，引导去手动添加。 -->
            <div v-if="parsedSource === 'owlfiles'">
              <div class="dav-parsed-ok">⚠ 已识别：猫头鹰文件二维码</div>
              <div class="dav-owl-warn-text">这个二维码里的密码是加密的、无法直接登录（实测扫码登录不上）。请改手动添加：密码用 Cloudreve 设置里的 WebDAV 密码，地址和用户名已帮你填好。</div>
              <div class="dav-parsed-row"><span>地址</span><b>{{ parsedMount.url }}</b></div>
              <div class="dav-parsed-row"><span>用户名</span><b>{{ parsedMount.username || '（空）' }}</b></div>
              <button class="login-modal-primary" @click="goManualFromOwl">去手动添加</button>
              <button class="login-modal-cancel" @click="resetScan">重新扫码</button>
            </div>
            <div v-else>
              <div class="dav-parsed-ok">✓ 已识别 <span class="dav-parsed-src">来源：{{ parsedSourceText }}</span></div>
              <label class="login-field"><span>名称</span><input v-model="parsedMount.name" type="text" /></label>
              <div class="dav-parsed-row"><span>地址</span><b>{{ parsedMount.url }}</b></div>
              <div class="dav-parsed-row"><span>用户名</span><b>{{ parsedMount.username || '（空）' }}</b></div>
              <div class="dav-parsed-row"><span>密码</span><b>{{ parsedMount.password ? '••••••••（已掩码）' : '（空）' }}</b></div>
              <label class="dav-check"><input type="checkbox" v-model="addRemember" /> 记住密码</label>
              <label class="dav-check"><input type="checkbox" :checked="addMode === 'direct'" @change="addMode = $event.target.checked ? 'direct' : 'proxy'" /> 直连（需服务器支持 CORS，默认走中转）</label>
              <button class="login-modal-primary" @click="saveParsedMount">保存挂载并进入</button>
              <button class="login-modal-cancel" @click="resetScan">重新扫码</button>
            </div>
          </div>
        </div>
        <div v-if="addTab === 'manual' || editingMountId" class="dav-manual">
          <label class="login-field"><span>显示名</span><input v-model="addName" type="text" placeholder="例如：家里 NAS" /></label>
          <label class="login-field"><span>服务器地址</span><input v-model="addUrl" type="text" inputmode="url" placeholder="https://host:port/path" @blur="splitManualUrl" /></label>
          <label class="login-field"><span>用户名</span><input v-model="addUser" type="text" autocomplete="username" /></label>
          <label class="login-field"><span>密码</span>
            <span class="dav-pass-wrap"><input v-model="addPass" :type="addShowPass ? 'text' : 'password'" autocomplete="current-password" />
            <button type="button" class="dav-eye" @click="addShowPass = !addShowPass">{{ addShowPass ? '隐藏' : '显示' }}</button></span>
          </label>
          <label class="dav-check"><input type="checkbox" v-model="addRemember" /> 记住密码（关掉则每次进入时输入）</label>
          <div class="dav-mode">
            <span>连接方式：</span>
            <label><input type="radio" value="proxy" v-model="addMode" /> 经 FlarePan 中转（推荐）</label>
            <label><input type="radio" value="direct" v-model="addMode" /> 直连（需服务器支持 CORS）</label>
          </div>
          <div v-if="addError" class="login-modal-error">{{ addError }}</div>
          <div v-if="addTestResult" class="dav-test-ok">{{ addTestResult }}</div>
          <div class="dav-form-btns">
            <button class="login-modal-cancel" @click="testAddMount" :disabled="addBusy">{{ addBusy ? '测试中…' : '测试连接' }}</button>
            <button class="login-modal-primary" @click="saveManualMount">保存挂载</button>
          </div>
        </div>
        <div v-if="addTab === 'drive' && !editingMountId" class="dav-manual">
          <div class="dav-scan-hint">用管理员配置的 Google 账号连接。首次授权会跳到 Google 登录页，同意后自动跳回。</div>
          <label class="login-field"><span>显示名（可空，默认取 Google 账号名）</span><input v-model="addDriveName" type="text" placeholder="例如：我的 Google Drive" /></label>
          <div v-if="addDriveError" class="login-modal-error">{{ addDriveError }}</div>
          <div class="dav-form-btns">
            <button class="login-modal-primary" @click="startDriveAuth" :disabled="addDriveBusy">{{ addDriveBusy ? '跳转中…' : '连接 Google Drive' }}</button>
          </div>
          <div class="dav-privacy">Google 授权信息与 refresh_token 只保存在本机浏览器，不会上传到 FlarePan 服务器。换设备或清除浏览器数据后需重新授权。你也可以随时在 Google 账号 → 第三方访问权限里移除 FlarePan 的授权。</div>
        </div>
        <div class="dav-privacy">配置与密码只保存在本机浏览器，不会上传到 FlarePan 服务器。换设备或清除浏览器数据后需重新添加。</div>
      </div>
    </Dialog>
    <Dialog :model-value="showMountPassword" @update:model-value="($event) => { if (!$event) showMountPassword = false; }">
      <form class="login-modal" @submit.prevent="submitMountPassword">
        <div class="login-modal-title">输入挂载密码</div>
        <div class="login-modal-sub">{{ mountPasswordTarget ? mountPasswordTarget.name : '' }} 未记住密码，请输入密码进入（只保存在本次会话内存中）</div>
        <label class="login-field"><span>密码</span>
          <input ref="mountPasswordInput" v-model="mountPasswordInput" type="password" autocomplete="current-password" />
        </label>
        <div v-if="mountPasswordError" class="login-modal-error">{{ mountPasswordError }}</div>
        <button type="submit" class="login-modal-primary">进入</button>
        <button type="button" class="login-modal-cancel" @click="showMountPassword = false">取消</button>
      </form>
    </Dialog>
    <Dialog :model-value="showShareQr" @update:model-value="($event) => { if (!$event) closeShareQr(); }">
      <div class="dav-share">
        <div class="dav-modal-title">分享挂载二维码</div>
        <div v-if="shareQrMount" class="dav-share-name">{{ shareQrMount.name }} · {{ shareQrMount.url }}</div>
        <div class="dav-tabs">
          <button :class="{ on: shareQrKind === 'json' }" @click="setShareQrKind('json')">FlarePan 二维码（含密码）</button>
          <button :class="{ on: shareQrKind === 'url' }" @click="setShareQrKind('url')">纯 URL 二维码（不含密码）</button>
        </div>
        <div v-if="shareQrMount && shareQrCleared[shareQrMount.id]" class="dav-share-cleared">
          该二维码已清除。如需再次显示，请点“再次显示”。
          <div style="margin-top: 12px;"><button class="login-modal-primary" @click="reshowShareQr">再次显示</button></div>
        </div>
        <div v-else>
          <div ref="shareQrBox" class="dav-qr-box"></div>
          <div v-if="shareQrError" class="dav-share-err">{{ shareQrError }}</div>
          <div class="dav-share-warn">含密码的二维码拍照即泄露：不要截图外发；对方扫完请点“清除”。</div>
          <div class="dav-form-btns">
            <button class="login-modal-cancel" @click="copyShareQrText">复制二维码内容</button>
            <button class="login-modal-primary" @click="clearShareQr">清除</button>
          </div>
        </div>
      </div>
    </Dialog>
  </div>
</template>

<script>
import {
  blobDigest,
  copyTextToClipboard,
  generateThumbnail,
  multipartUpload,
  SIZE_LIMIT,
} from '/assets/main.mjs';
import Dialog from './Dialog.vue';
import MimeIcon from './MimeIcon.vue';
import Footer from './Footer.vue';
import AudioPlayer from './AudioPlayer.vue';
import PdfPreview from './PdfPreview.vue';
import VideoPlayer from './VideoPlayer.vue';
import TextPreview from './TextPreview.vue';
import ImagePreview from './ImagePreview.vue';
import InfoPreview from './InfoPreview.vue';
import Admin from './Admin.vue';
import {
  DAV_MAX_UPLOAD_MB,
  clearActiveRef,
  connectionErrorText,
  davDelete,
  davErrorText,
  davFetch,
  davMkcol,
  davMove,
  davPut,
  davUploadXhr,
  flarepanQrPayload,
  loadActiveRef,
  loadMounts,
  mediaProxyUrl,
  normalizeMount,
  parseDavQr,
  parsePropfind,
  parsePropfindOne,
  plainUrlQrPayload,
  qrParseErrorText,
  saveActiveRef,
  saveMounts,
  testMountConnection,
} from '/assets/dav-mounts.mjs';
import {
  buildAuthUrl,
  clearAccessToken,
  clearDriveActiveRef,
  clearOAuthPending,
  driveExportMime,
  driveFileUrl,
  driveMediaUrl,
  exchangeCode,
  fetchDriveAbout,
  fetchDriveFiles as fetchDriveList,
  generateCodeChallenge,
  generateCodeVerifier,
  generateState,
  getAccessToken,
  getMountProviders,
  loadDriveActiveRef,
  loadDriveMounts,
  loadOAuthPending,
  normalizeDriveMount,
  revokeDriveToken,
  saveDriveActiveRef,
  saveDriveMounts,
  saveOAuthPending,
  setAccessToken,
} from '/assets/drive-mounts.mjs';

// 路径归一：去掉尾部多余斜杠。短链目标曾多带一个 "/"（见 shorten 归一化），
// 浏览器据此请求的列表地址以 "//" 结尾，Pages 路由不到函数而回静态 404，
// 前端便显示“加载失败”。根目录（"" 或全斜杠）归一为空串。
function normalizeCwd(p) {
  return (p || '').replace(/\/+$/, '');
}

// 文件夹缓存有效期：60 秒内 revisits 零请求、瞬时渲染；过期命中先
// 渲染旧数据、后台静默刷新（App 内没有任何写列表的操作，缓存不会
// 被本站写脏；后台页上传后由后台页自己刷新，前台 60 秒后自然更新）。
const FOLDER_CACHE_TTL_MS = 60 * 1000;

// 应用内下拉刷新：列表到顶下拉超过该距离松开即重载当前文件夹。
// 指示器高度上限（手指位移按 0.5 折算后封顶）。
const PTR_PULL_THRESHOLD = 60;
const PTR_MAX_PULL = 80;

export default {
  data: () => {
    // WebDAV 挂载恢复：localStorage 里的挂载列表 + sessionStorage 里
    // 的当前挂载（刷新后仍留在挂载内；挂载已被删时回我的网盘）。
    const davMounts = loadMounts();
    let activeMountId = '';
    let initialCwd = normalizeCwd(
      new URL(window.location).searchParams.get('p') || ''
    );
    try {
      const ref = loadActiveRef();
      if (ref && davMounts.some((m) => m.id === ref.mountId)) {
        activeMountId = ref.mountId;
        initialCwd = normalizeCwd(ref.cwd || '');
      }
    } catch (e) {}
    // Google Drive 挂载恢复：localStorage 里的挂载列表 + sessionStorage
    // 里的当前 Drive 位置（刷新后仍留在 Drive 内；挂载已被删时回我的网盘）。
    const driveMounts = loadDriveMounts();
    let activeDriveMountId = '';
    let driveFolderId = 'root';
    let driveCrumbs = [];
    try {
      const dref = loadDriveActiveRef();
      if (dref && driveMounts.some((m) => m.id === dref.mountId)) {
        activeDriveMountId = dref.mountId;
        driveFolderId = dref.folderId || 'root';
        driveCrumbs = Array.isArray(dref.crumbs) ? dref.crumbs : [];
      }
    } catch (e) {}
    return {
    cwd: initialCwd,
    files: [],
    folders: [],
    focusedItem: null,
    // 排序（IA：列表头即排序控件，每位置各自记忆，见 loadPlaceSort）。
    // sortKey: 'name' | 'size' | 'date'；sortDir: 'asc' | 'desc'。
    sortKey: 'name',
    sortDir: 'asc',
    search: '',
    showContextMenu: false,
    copiedItem: null,
    // 应用内下拉刷新状态：ptrTracking 只在 touchstart 时列表已到顶才
    // 建立；ptrHeight 是指示器当前高度（px），ptrState 为
    // 'idle' | 'pulling' | 'refreshing'。
    ptrTracking: false,
    ptrStartY: 0,
    ptrHeight: 0,
    ptrState: 'idle',
    // 文件夹缓存：cwd → { files, folders, at }（见 FOLDER_CACHE_TTL_MS）。
    // 命中直接渲染、零请求；过期命中先渲染旧数据、后台静默刷新。
    // 分享模式不用缓存（授权可能过期，始终请求）。
    folderCache: {},
    // 请求序号 guard：快速连点文件夹时，旧请求后到直接丢弃，不覆盖
    // 新文件夹内容。后台静默刷新同样占一个序号。
    fetchSeq: 0,
    // 导航加载态：有旧列表时保留旧列表、只在顶部显示细加载条；
    // 首次加载（无旧内容）才显示“加载中...”（loading）。
    navLoading: false,
    // 首次挂载的 immediate watcher 不回顶（页面本来就在顶部）。
    // 注意：data 里以下划线开头的键不会被代理到实例上，所以不用 _ 前缀。
    cwdFirstRun: true,
    // 复制反馈：toast 文案（2.5 秒自动消失）与手动复制兜底框。
    toastText: '',
    toastTimer: null,
    // 自定义状态提示（替代原生 title）：桌面悬停、手机长按 600ms 显示，
    // 内容就是 mountTooltip 的两行文案（标题“显示名 · 状态”+ 说明行）。
    // 原生 title 手机长按不触发，所以另做这一套。
    mountTip: { show: false, title: '', detail: '', dotClass: '', left: 0, top: 0 },
    mountTipTimer: null,
    mountTipLongPress: false,
    showManualCopy: false,
    manualCopyTitle: '',
    manualCopyText: '',
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
    // 分享 ?file= 直达（v22）：验码通过、列表加载完成后自动打开一次；
    // 打开过（或找不到文件）即置 true，不再重复触发。
    shareFileOpened: false,
    // 前端版本戳：每次部署同步 bump（见 assets/version.json）。
    // 手机浏览器常把标签页留存数日不刷新，旧代码会让视频继续走新标签页；
    // 已加载的旧页在切回可见时发现版本不一致就自动重载，之后不再有旧代码。
    appVersion: '20261116-09', // 注意：与 assets/version.json 的 version 必须同步改，两处不一致时前台挂载即循环 reload（2026-11-04 -21 教训）
    // 播放器挂在 App 根节点，文件夹切换、前进后退、PDF 浮层都不卸载它。
    playerQueue: [],
    playerStartIndex: 0,
    pendingAudio: null,
    showAudioPrompt: false,
    // 站内管理员登录弹窗：权限不够时替代浏览器原生 Basic Auth 框。
    // loginPending：登录成功后继续的操作；loginNext：直接打开受保护
    // 文件被带回站内时的回跳地址（二者有其一，loginNext 优先）。
    showLogin: false,
    loginUser: '',
    loginPass: '',
    loginError: '',
    loginBusy: false,
    loginPending: null,
    loginNext: '',
    // 站内视频播放：默认居中大窗，可切右下角小窗；不压历史，不碰音频条以外的状态。
    videoUrl: '',
    videoName: '',
    // 短链总开关：公开配置 /api/site-config 的 shortlink_enabled 决定；
    // 取不到时默认开启（与旧行为一致），开关关闭时全部短链入口隐藏。
    siteShortlinkEnabled: true,
    // Theme skin: server site-config wins; localStorage only paints
    // the first paint before the fetch returns.
    skin: (() => {
      try {
        const cached = localStorage.getItem('pan-skin');
        return cached === 'starship' || cached === 'original'
            ? cached : 'original';
      } catch (e) {
        return 'original';
      }
    })(),
    backgroundImageUrl: '/assets/bg-light.webp',
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
    // ---- WebDAV 挂载（v1 只读）----
    // 配置只存 localStorage（davMounts）；当前挂载只存 sessionStorage。
    davMounts,
    activeMountId,
    // 不记住密码的挂载：本次会话内输入的密码只放内存，不落盘。
    mountSessionPasswords: {},
    mountStatus: '', // '' | 'ok' | 'fail'：当前挂载的连接状态（状态芯片用）
    mountLoadError: '', // '' | 'auth' | 'failed'：挂载列表加载失败原因
    // 挂载管理抽屉。
    showMountManager: false,
    mountTestResults: {},
    mountDeleteArmed: '',
    // 添加 / 编辑挂载。
    showAddMount: false,
    editingMountId: '',
    addTab: 'scan',
    addName: '',
    addUrl: '',
    addUser: '',
    addPass: '',
    addShowPass: false,
    addRemember: true,
    addMode: 'proxy',
    addBusy: false,
    addError: '',
    addTestResult: '',
    // 扫码。
    scanState: '', // '' | 'scanning' | 'parsed' | 'error'
    scanError: '',
    scanPaste: '',
    parsedMount: null,
    parsedSource: '',
    // 未记密码的挂载：进入时弹密码框。
    showMountPassword: false,
    mountPasswordTarget: null,
    mountPasswordInput: '',
    mountPasswordError: '',
    // 分享二维码。
    showShareQr: false,
    shareQrMount: null,
    shareQrKind: 'json',
    shareQrCleared: {},
    shareQrText: '',
    shareQrError: '',
    // ---- WebDAV 挂载二阶段（上传 / 新建 / 重命名 / 删除 / 文本编辑）----
    // 上传队列：每项 { id, name, file, relPath, status, loaded, total,
    //   error, controller }；status: queued|uploading|done|failed|cancelled。
    // 一次只传一个（顺序），整批结束才刷新一次列表。
    mountUploads: [],
    uploadQueueRunning: false,
    // 同名冲突的批量选择：'' | 'overwrite' | 'rename' | 'cancel'。
    uploadBatchChoice: '',
    // 待用户决定的同名冲突：{ item, applyToAll } + 挂起的 resolve。
    uploadConflict: null,
    uploadConflictResolve: null,
    // 拖拽悬停：计数（进出子元素会反复触发，用计数防闪烁）。
    dragDepth: 0,
    dragOver: false,
    dragFileCount: 0,
    // 新建文件夹 / 重命名 / 删除三个 Dialog。
    showMkdirDialog: false,
    mkdirName: '',
    mkdirError: '',
    mkdirBusy: false,
    showRenameDialog: false,
    renameTarget: null, // 文件对象或文件夹路径串
    renameName: '',
    renameError: '',
    renameBusy: false,
    showDeleteDialog: false,
    deleteTarget: null,
    deleteText: '',
    deleteBusy: false,
    // 挂载内新建菜单（列表头右端玻璃「＋ 新建」钮的下拉菜单）。
    showCreateMenu: false,
    // 文本编辑基线：打开文本文件时记下的 ETag / 大小 / 修改时间，
    // 保存时先 PROPFIND 比对，变了就弹冲突框（默认以服务器为准）。
    textKey: 0,
    textSaving: false,
    textEditFile: null,
    textEditEtag: '',
    textEditSize: 0,
    textEditUploaded: '',
    // 待用户决定的文本冲突：{ detail, overwriteLabel, discardLabel,
    //   pendingText } + 挂起的 resolve。
    textConflict: null,
    textConflictResolve: null,
    // ---- Google Drive 挂载（v1 只读）----
    // 配置只存 localStorage（driveMounts）；access_token 只放内存
    // （drive-mounts.mjs 的 tokenStore + 下面的 driveAccessToken 字段，
    // 页面刷新即丢）；当前 Drive 位置只存 sessionStorage。
    driveMounts,
    activeDriveMountId,
    driveFolderId,
    driveCrumbs,
    // 当前 Drive 挂载的 access_token（内存，供媒体元素 ?t= 用；
    // openFile 里先确保新鲜再打开，过期由 driveFetch 静默刷新）。
    driveAccessToken: '',
    driveNextPageToken: '',
    driveLoadMoreBusy: false,
    driveTestResults: {},
    driveDeleteArmed: '',
    // 添加 Google Drive（第三个 Tab）：显示名。Client ID 与重定向 URI
    // 由服务端配置（管理后台「挂载」页），前端不再让用户填。
    addDriveName: '',
    addDriveBusy: false,
    addDriveError: '',
    // 管理员已配置且已启用的挂载提供商（GET /api/mounts/providers，
    // 公开值，不含 Secret）；Drive 页签只在含 google-drive 时出现。
    mountProviders: [],
    mountProvidersLoaded: false,
    mountProvidersBusy: false,
    // 重新授权中的 Drive 挂载（重新授权 = 走一遍 §4.2，拿新 token）。
    driveReauthMount: null,
    driveReauthBusy: false,
    };
  },

  computed: {
    // 下拉刷新指示器文案：刷新中固定，拉过阈值提示松开，否则提示下拉。
    ptrLabel() {
      if (this.ptrState === 'refreshing') return '正在刷新…';
      return this.ptrHeight >= PTR_PULL_THRESHOLD ? '松开刷新' : '下拉刷新';
    },

    isAdminPage() {
      const p = window.location.pathname;
      return p === '/admin' || p.startsWith('/admin/');
    },

    isStarship() {
      return this.skin === 'starship';
    },

    shareMode() {
      return !!this.shareSlug;
    },

    // 当前挂载（null = 我的网盘）。
    activeMount() {
      if (!this.activeMountId) return null;
      return this.davMounts.find((m) => m.id === this.activeMountId) || null;
    },

    activeMountName() {
      return this.activeMount ? this.activeMount.name : '';
    },

    // 当前 Drive 挂载（null = 不在 Drive 内）。与 activeMount 平行，
    // 同一时刻最多一个有值（switchLocation 保证互斥）。
    activeDriveMount() {
      if (!this.activeDriveMountId) return null;
      return this.driveMounts.find((m) => m.id === this.activeDriveMountId) || null;
    },

    activeDriveMountName() {
      return this.activeDriveMount ? this.activeDriveMount.name : '';
    },

    // 当前位置（DAV / Drive / 本地）——位置栏标签与状态芯片用。
    activeLocationMount() {
      return this.activeMount || this.activeDriveMount;
    },

    activeLocationName() {
      return this.activeLocationMount ? this.activeLocationMount.name : '';
    },

    // 扫码解析来源文案。
    parsedSourceText() {
      const map = {
        owlfiles: '猫头鹰文件二维码',
        flarepan: 'FlarePan 二维码',
        url: '通用 URL 二维码',
        dav: '通用 URL 二维码',
      };
      return map[this.parsedSource] || '二维码';
    },

    // 空态文案（IA）：无挂载、无文件时给一句有用的提示，而不是
    // 干巴巴的“没有文件”；在挂载内或有挂载时只说文件夹是空的。
    emptyStateText() {
      if (this.search) return '没有找到匹配的文件';
      if (!this.davMounts.length && !this.driveMounts.length
          && !this.activeLocationMount && !this.cwd) {
        return '这里是空的，点上方 ＋ 添加一个挂载';
      }
      return '这个文件夹是空的';
    },

    // 空态插画种类：search = 放大镜变体，nomount = 空文件夹 +
    // 小加号徽标（提示去添加挂载），folder = 空文件夹。
    // 插画主体共用（敞开的文件夹 + 漂浮的星点 + 虚线轨道）。
    emptyStateKind() {
      if (this.search) return 'search';
      if (!this.davMounts.length && !this.driveMounts.length
          && !this.activeLocationMount && !this.cwd) return 'nomount';
      return 'folder';
    },

    // 状态芯片：只显示位置名，不再写“已连接/连接失败”文字（IA 决定：
    // 悬停提示已经给了状态，文字是重复的；状态只看标签上的点）。
    shipLabel() {
      if (this.activeLocationMount) {
        return this.activeLocationMount.name;
      }
      return '舰体在线';
    },

    shipDotClass() {
      if (!this.activeLocationMount) return '';
      return this.mountStatus === 'fail' ? 'dot-bad' : 'dot-ok';
    },

    // 舰体芯片的悬停提示（当前挂载的状态说明；本地时无）。
    shipTooltip() {
      if (!this.activeLocationMount) return '';
      return this.mountTooltip(this.activeLocationMount);
    },

    filteredFiles() {
      // 文件夹标记（"_$folder$"）是存储层内部对象，绝不是用户
      // 文件：服务端各列表已过滤，这里再兜底一道，防服务端回归
      // 或缓存的旧响应把它当文件行渲染出来。
      // Drive 文件的 key 是文件 id（不是路径），显示名走 file.name。
      let files = this.files.filter((file) => {
        const name = file.name || (file.key || '').split('/').pop() || '';
        return !name.includes('_$folder$') && !(file.key || '').split('/').includes('_$folder$');
      });
      if (this.search) {
        files = files.filter((file) => {
          const name = file.name || (file.key || '').split('/').pop() || '';
          return name.includes(this.search);
        });
      }
      return files;
    },

    filteredFolders() {
      // Drive 文件夹是 { id, name } 对象（没有路径字符串），
      // WebDAV / 本地文件夹是路径字符串：两边各走各的判定。
      const nameOf = (folder) =>
        folder && typeof folder === 'object' ? folder.name || '' : String(folder || '');
      // 显示名：Drive 取 name，WebDAV / 本地取路径末段。
      const displayNameOf = (folder) => {
        if (folder && typeof folder === 'object') return folder.name || '';
        const s = String(folder || '').replace(/\/+$/, '');
        return s.split('/').pop() || s;
      };
      let folders = this.folders.filter((folder) => {
        const name = nameOf(folder);
        if (name.includes('_$folder$')) return false;
        if (typeof folder === 'string' && folder.split('/').includes('_$folder$')) return false;
        return true;
      });
      if (this.search) {
        folders = folders.filter((folder) => nameOf(folder).includes(this.search));
      }
      // 文件夹按显示名自然排序（数字按数值比：第2课 < 第10课）；
      // 服务端返回是字典序，带数字的文件夹不排会 10 跑到 2 前面。
      // “返回上级目录”行不在 folders 里，不受影响。
      folders.sort((a, b) =>
        this.naturalCompare(displayNameOf(a), displayNameOf(b)));
      return folders;
    },

    // 星图路径：由 cwd 生成；分享模式以 shareRoot 为根，绝不越出授权前缀。
    // Drive 挂载不用 cwd，改用 driveCrumbs 栈（[{ id, name }]，根级为挂载名）。
    crumbs() {
      if (this.activeDriveMount) {
        const out = [{
          label: this.activeDriveMount.name,
          path: '',
          driveId: 'root',
          driveIndex: -1,
        }];
        this.driveCrumbs.forEach((c, i) => {
          out.push({ label: c.name, path: '', driveId: c.id, driveIndex: i });
        });
        return out;
      }
      const norm = (p) => (p || '').replace(/\/+$/, '');
      const base = this.shareMode ? (this.shareRoot || '') : '';
      const rel = norm(this.cwd).slice(norm(base).length).replace(/^\/+/, '');
      const segs = rel ? rel.split('/') : [];
      const out = [{
        label: this.activeMount ? this.activeMount.name : '⌖ 根星域',
        path: base,
      }];
      let acc = base;
      segs.forEach((s) => {
        acc = acc ? acc + s + '/' : s + '/';
        out.push({ label: s, path: acc });
      });
      return out;
    },

    // 右键菜单标题：文件用显示名（Drive 文件的 key 是 id，不是路径），
    // 文件夹用路径 basename 或 Drive 文件夹名。
    focusedItemName() {
      const item = this.focusedItem;
      if (!item) return '';
      if (typeof item === 'string') return item.match(/.*?([^/]*)\/?$/)[1] || item;
      if (item.name) return item.name;
      if (item.key) return (item.key || '').split('/').pop() || item.key;
      return '';
    },

    // Drive 断连文案（DESIGN.md §8.2 分层）。
    driveLoadErrorText() {
      if (this.mountLoadError === 'auth') return '授权已失效：请点“重新授权”重新登录 Google';
      if (this.mountLoadError === 'rate') return '请求太频繁，稍后重试';
      if (this.mountLoadError === 'forbidden') return 'Google 拒绝了访问：请确认 Drive API 已启用、账号有权限';
      return '无法连接 Google，请检查网络';
    },

    // 管理员配置的 Google Drive 提供商（未配置时为 null，Drive 页签隐藏）。
    driveProvider() {
      return (this.mountProviders || []).find((p) => p && p.id === 'google-drive') || null;
    },

    // 文本编辑按钮的出现条件（挂载内 + 文本文件 + ≤500KB；全文是否
    // 加载成功由 TextPreview 内部再判断——超过 500KB 拉到的不是全文，
    // 编辑会丢内容，宁可不给编）。
    textEditable() {
      return !!(
        this.activeMount &&
        !this.shareMode &&
        this.textEditFile &&
        this.isTextFile(this.textEditFile) &&
        (this.textEditFile.size || 0) <= 500 * 1024
      );
    },

    // 上传队列汇总文案（复用 Admin.vue 的批量进度形态）。
    mountUploadSummary() {
      const total = this.mountUploads.length;
      const done = this.mountUploads.filter((u) => u.status === 'done').length;
      const failed = this.mountUploads.filter((u) => u.status === 'failed').length;
      const active = this.mountUploads.find((u) => u.status === 'uploading');
      const loaded = this.mountUploads.reduce((s, u) => s + (u.loaded || 0), 0);
      const all = this.mountUploads.reduce((s, u) => s + (u.total || 0), 0);
      const pct = all > 0 ? Math.round((loaded / all) * 100) : 0;
      let s = '正在上传 ' + done + '/' + total + ' · ' + pct + '% · ' +
        this.formatSize(loaded) + '/' + this.formatSize(all);
      if (failed) s += ' · ' + failed + ' 个失败';
      if (active) s += ' · ' + active.name;
      return s;
    },
  },

  methods: {
    // 一键换装：dataset + localStorage + favicon 一次写完，当前页立即
    // 生效、不刷新。优先走 <head> 里的共享助手，未加载时本地兜底。
    applySkin(skin) {
      if (skin !== 'starship' && skin !== 'original') return;
      if (window.__panSkin) {
        window.__panSkin.applySkin(skin);
        return;
      }
      document.documentElement.dataset.skin = skin;
      try { localStorage.setItem('pan-skin', skin); }
      catch (e) {}
      const links = document.querySelectorAll('link[rel="icon"]');
      links.forEach((l) => l.parentNode && l.parentNode.removeChild(l));
      const link = document.createElement('link');
      link.rel = 'icon';
      link.type = 'image/png';
      link.href = skin === 'starship'
          ? '/assets/planet-favicon.png?v=2' : '/favicon.ico';
      document.head.appendChild(link);
    },

    // 复制成功后的行内 ✓ 标记：2 秒后清除（与 toast 互补）。
    markCopied(itemKey) {
      if (!itemKey) return;
      this.copiedItem = itemKey;
      setTimeout(() => {
        if (this.copiedItem === itemKey) this.copiedItem = null;
      }, 2000);
    },

    // 底部 toast：任何复制结果都必须有可见反馈，不能静默。
    showToast(text) {
      this.toastText = text;
      if (this.toastTimer) clearTimeout(this.toastTimer);
      this.toastTimer = setTimeout(() => {
        this.toastText = '';
        this.toastTimer = null;
      }, 2500);
    },

    // 手动复制兜底框：剪贴板两种写法都失败时用（替代 window.prompt，
    // prompt 在微信等内置浏览器里常被屏蔽、点完无反应）。
    openManualCopy(title, text) {
      this.manualCopyTitle = title;
      this.manualCopyText = text;
      this.showManualCopy = true;
      this.$nextTick(() => {
        const el = this.$refs.manualCopyInput;
        if (el) {
          el.focus();
          el.select();
          try {
            el.setSelectionRange(0, text.length);
          } catch (e) {}
        }
      });
    },

    closeManualCopy() {
      this.showManualCopy = false;
      this.manualCopyTitle = '';
      this.manualCopyText = '';
    },

    // 复制链接（菜单唯一入口）：短链优先，长链兜底。
    // 短链总开关开着时先调 /api/shorten 拿短链并复制；短链未配置、
    // 短链接口报错或写剪贴板失败时，一律回落到复制长链（不 alert、
    // 不中断）。401 时弹站内登录框，登录成功后重试本次复制。
    async copyLink(link, itemKey) {
      this.showContextMenu = false;
      const key = itemKey || (typeof this.focusedItem === 'string'
        ? 'folder:' + this.focusedItem
        : (this.focusedItem && this.focusedItem.key
          ? 'file:' + this.focusedItem.key : null));
      if (this.siteShortlinkEnabled) {
        try {
          const res = await fetch('/api/shorten', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ target: link }),
          });
          const data = await res.json().catch(() => ({}));
          if (res.ok && data.shortLink) {
            // 注意：写剪贴板发生在 await fetch 之后，用户手势可能已失效
            //（iOS Safari 与内置浏览器常见），助手内部先试 Clipboard
            // API 再试 execCommand，都失败才弹手动复制框。
            const ok = await copyTextToClipboard(data.shortLink);
            if (ok) {
              this.markCopied(key);
              this.showToast('短链已复制');
            } else {
              this.openManualCopy('短链地址（请手动复制）：', data.shortLink);
            }
            return;
          }
          if (res.status === 401) {
            // 无权访问：弹站内登录框，登录成功后重试本次复制。
            this.openLoginModal(() => this.copyLink(link, itemKey));
            return;
          }
          // 其他短链失败（接口报错/无短链）：回落到长链。
        } catch (e) {
          // 网络异常：回落到长链。
        }
      }
      const url = new URL(link, window.location.origin).toString();
      const ok = await copyTextToClipboard(url);
      if (ok) {
        // 行内 ✓：按当前聚焦项换算（菜单里点的是它）。
        this.markCopied(key);
        this.showToast('链接已复制');
      } else {
        this.openManualCopy('链接地址（请手动复制）：', url);
      }
    },

    // 站内管理员登录：替代浏览器原生 Basic Auth 框。pending 是登录
    // 成功后继续的回调；直接打开受保护文件被带回站内时（?login=1）
    // 用 loginNext 回跳原文件，优先于 pending。
    openLoginModal(pending) {
      this.loginPending = typeof pending === 'function' ? pending : null;
      this.loginError = '';
      this.showLogin = true;
      this.$nextTick(() => {
        const el = this.$refs.loginUserInput;
        if (el) el.focus();
      });
    },

    onLoginDialogToggle(v) {
      if (!v) this.closeLogin();
      else this.showLogin = true;
    },

    closeLogin() {
      this.showLogin = false;
      this.loginPending = null;
      this.loginNext = '';
      this.loginError = '';
      this.loginBusy = false;
      // 登录跳转参数只用一次：取消后从地址栏去掉，刷新不再自动弹框。
      const url = new URL(window.location);
      if (url.searchParams.has('login')) {
        url.searchParams.delete('login');
        url.searchParams.delete('next');
        window.history.replaceState(null, '', url.toString());
      }
    },

    async submitLogin() {
      if (this.loginBusy) return;
      if (!this.loginUser || !this.loginPass) {
        this.loginError = '请输入账号和密码';
        return;
      }
      this.loginBusy = true;
      this.loginError = '';
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: this.loginUser,
            password: this.loginPass,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          // 服务端原话（如“账号或密码错误”），可重试。
          this.loginError = (data && data.error) || '登录失败，请重试';
          return;
        }
        this.loginPass = '';
        const pending = this.loginPending;
        const next = this.loginNext;
        this.closeLogin();
        if (next) {
          window.location.href = next;
          return;
        }
        if (pending) pending();
      } catch (e) {
        this.loginError = '登录失败，请重试';
      } finally {
        this.loginBusy = false;
      }
    },

    // 打开预览 / 下载前预检：HEAD /raw/<key>，401 才弹登录框；其他
    // 状态按原流程继续（403 等由预览组件自己报错，与今天一致）。
    async precheckRaw(key) {
      try {
        const url = '/raw/' + key.split('/').map(encodeURIComponent).join('/');
        const res = await fetch(url, { method: 'HEAD' });
        return res.status;
      } catch (e) {
        return 0;
      }
    },

    async downloadFile(item) {
      // 右键菜单下载：先预检，401 弹登录框、登录成功后继续下载；
      // 已登录或公开文件直接触发浏览器下载（保留 download 行为，
      // 不加 target="_blank"：iOS 会忽略 download 并新标签页打开）。
      this.showContextMenu = false;
      const key = item && typeof item === 'object' ? item.key : null;
      if (!key) return;
      // Drive 内文件走 drive-proxy 下载（?t=accessToken；原生文档
      // 按导出格式下载，表单等无导出格式的无法下载）。
      if (this.activeDriveMount) {
        await this.downloadDriveFile(item);
        return;
      }
      // 挂载内文件走代理下载。
      if (this.activeMount) {
        await this.downloadMountFile(item);
        return;
      }
      const st = await this.precheckRaw(key);
      if (st === 401) {
        this.openLoginModal(() => this.downloadFile(item));
        return;
      }
      const a = document.createElement('a');
      a.href = '/raw/' + key.split('/').map(encodeURIComponent).join('/');
      a.download = '';
      document.body.appendChild(a);
      a.click();
      a.remove();
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

    // 分享 ?file= 直达（v22）：验码通过、列表加载完成后，若 ?file= 指
    // 名的文件在当前分享文件夹列表里，只自动打开一次（调现有 openFile，
    // 走已验通的 PDF 查看器/音频播放器）；找不到则正常显示文件夹列表。
    // ?file= 只取文件名，不出分享文件夹；OAuth 回调不碰该参数
    // （handleDriveCallback 只在真有待处理 Drive OAuth 时才接手 URL）。
    maybeOpenSharedFile() {
      if (!this.shareMode || this.shareState !== 'ready'
          || this.shareFileOpened) return;
      let name = '';
      try {
        name = new URL(window.location).searchParams.get('file') || '';
      } catch (e) { name = ''; }
      name = (name || '').trim();
      if (!name) return;
      this.shareFileOpened = true;
      const file = (this.files || []).find((f) => {
        const key = (f && f.key) || '';
        const base = key.split('/').pop() || '';
        return base === name || (f && f.name) === name;
      });
      if (!file) return;
      this.$nextTick(() => this.openFile(file));
    },

    // 列表切换淡入：class 去掉 → 强制 reflow → 加回，动画重播一次。
    // 只在文件夹导航渲染后调用（搜索/排序不走 fetchFiles，不误触发）。
    animateList() {
      this.$nextTick(() => {
        const el = this.$refs.listWrap;
        if (!el) return;
        el.classList.remove('list-in');
        void el.offsetWidth;
        el.classList.add('list-in');
      });
    },

    fetchFiles() {
      if (this.isAdminPage) return;
      // 分享模式未验码前绝不拉列表（首屏 immediate watcher 也一样）。
      if (this.shareMode && this.shareState !== 'ready') return;
      // 挂载内走 PROPFIND 分支，不走本地 /api/children 与 folderCache。
      if (this.activeMount) {
        this.fetchMountFiles();
        return;
      }
      // Drive 挂载内走 files.list 分支（§10.2 第 4 点），同样不走本地。
      if (this.activeDriveMount) {
        this.fetchDriveFiles(false);
        return;
      }
      const cwd = normalizeCwd(this.cwd);
      // 命中缓存：直接渲染，零请求、零闪白；过期命中先渲染旧数据、
      // 后台静默刷新（刷新到的数据仍以请求序号 guard 为准）。
      if (!this.shareMode) {
        const hit = this.folderCache[cwd];
        if (hit) {
          this.files = hit.files.slice();
          this.folders = hit.folders.slice();
          // 缓存里存的是上次的排序，切走再回来排序可能已换，重排一次。
          this.sortCurrentFiles();
          this.loading = false;
          this.loadError = '';
          this.navLoading = false;
          this.animateList();
          if (Date.now() - hit.at < FOLDER_CACHE_TTL_MS) return;
          this.refreshFolderInBackground(cwd);
          return;
        }
      }
      // 无缓存：有旧列表时保留旧列表 + 顶部细加载条，不闪白；
      // 首次加载（无旧内容）才显示“加载中...”。
      const hasOld = this.files.length > 0 || this.folders.length > 0;
      this.loading = !hasOld;
      this.navLoading = hasOld;
      this.loadError = '';
      const seq = ++this.fetchSeq;
      fetch(`/api/children/${cwd}`)
        .then(async (res) => {
          // 旧请求后到：连 401/错误态也不碰，避免污染新文件夹。
          if (seq !== this.fetchSeq) return null;
          if (res.status === 401) {
            // 分享授权失效：回输码框，不显示“无权访问”。
            if (this.shareMode) {
              this.shareState = 'code';
              this.shareRoot = '';
              sessionStorage.removeItem('share:' + this.shareSlug);
              this.loadError = '';
              this.loading = false;
              this.navLoading = false;
              return null;
            }
            this.loadError = 'forbidden';
            this.loading = false;
            this.navLoading = false;
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
          if (seq !== this.fetchSeq || !files) return;
          this.files = files.value || [];
          this.sortCurrentFiles();
          this.folders = files.folders || [];
          if (!this.shareMode) {
            // 存一份拷贝：排序等原地操作只动当前视图，不动缓存。
            this.folderCache[cwd] = {
              files: this.files.slice(),
              folders: this.folders.slice(),
              at: Date.now(),
            };
          }
          this.loading = false;
          this.navLoading = false;
          this.animateList();
          this.maybeOpenSharedFile();
        })
        .catch(() => {
          if (seq !== this.fetchSeq) return;
          this.files = [];
          this.folders = [];
          this.loadError = 'failed';
          this.loading = false;
          this.navLoading = false;
        });
    },

    // 后台静默刷新：只更新缓存与当前仍在看的这个文件夹，不闪、不报错。
    refreshFolderInBackground(cwd) {
      const seq = ++this.fetchSeq;
      fetch(`/api/children/${cwd}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (seq !== this.fetchSeq || !data) return;
          const files = (data.value || []).filter((file) =>
            !file.key.split('/').includes('_$folder$'));
          const folders = data.folders || [];
          this.folderCache[cwd] = { files, folders, at: Date.now() };
          if (normalizeCwd(this.cwd) === cwd) {
            this.files = files;
            this.folders = folders;
            this.sortCurrentFiles();
          }
        })
        .catch(() => {});
    },

    // 应用内下拉刷新（touch 驱动）：只在列表已到顶时建立追踪；下拉
    // 距离按 0.5 折算成指示器高度（封顶 PTR_MAX_PULL）。overscroll
    // 仍为 none，原生下拉刷新不会触发；下拉时 preventDefault 阻止
    // 容器本身的回弹滚动，指示器跟手。松开时拉过阈值即重载当前
    // 文件夹（删缓存强制走网络），否则指示器收回。
    onPtrTouchStart(e) {
      if (this.ptrState === 'refreshing') return;
      const el = this.$refs.mainScroll;
      if (!el || el.scrollTop > 0) {
        this.ptrTracking = false;
        return;
      }
      const t = e.touches && e.touches[0];
      if (!t) return;
      this.ptrTracking = true;
      this.ptrStartY = t.clientY;
      this.ptrHeight = 0;
    },

    onPtrTouchMove(e) {
      if (!this.ptrTracking || this.ptrState === 'refreshing') return;
      const el = this.$refs.mainScroll;
      const t = e.touches && e.touches[0];
      if (!t || !el) return;
      if (el.scrollTop > 0) {
        this.ptrTracking = false;
        this.ptrHeight = 0;
        return;
      }
      const dy = t.clientY - this.ptrStartY;
      if (dy <= 0) {
        this.ptrHeight = 0;
        return;
      }
      e.preventDefault();
      this.ptrState = 'pulling';
      this.ptrHeight = Math.min(dy * 0.5, PTR_MAX_PULL);
    },

    onPtrTouchEnd() {
      if (!this.ptrTracking) return;
      this.ptrTracking = false;
      if (this.ptrState === 'pulling' && this.ptrHeight >= PTR_PULL_THRESHOLD) {
        this.doPullRefresh();
      } else {
        this.ptrState = 'idle';
        this.ptrHeight = 0;
      }
    },

    doPullRefresh() {
      if (this.ptrState === 'refreshing') return;
      this.ptrState = 'refreshing';
      this.ptrHeight = 48;
      // 删缓存强制走网络：否则缓存新鲜时 fetchFiles 直接返回、不刷新。
      delete this.folderCache[normalizeCwd(this.cwd)];
      this.fetchFiles();
      // 加载落定（loading 与 navLoading 都收起）即收起指示器；6 秒
      // 上限兜底，请求挂住时指示器也不会一直卡着。
      const t0 = Date.now();
      const settle = () => {
        if ((!this.loading && !this.navLoading) || Date.now() - t0 > 6000) {
          this.ptrState = 'idle';
          this.ptrHeight = 0;
        } else {
          setTimeout(settle, 120);
        }
      };
      setTimeout(settle, 300);
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


    // ---- 排序与位置记忆（IA）----
    // 位置键：主盘 'local'，挂载 'dav:<id>' / 'drive:<id>'，分享 'share:<slug>'。
    placeSortKey() {
      if (this.activeMountId) return 'dav:' + this.activeMountId;
      if (this.activeDriveMountId) return 'drive:' + this.activeDriveMountId;
      if (this.shareMode) return 'share:' + (this.shareSlug || '');
      return 'local';
    },

    // 读当前位置的排序偏好：localStorage 键 pan-sort:<place>；
    // 默认值：主盘按名称↑，挂载按修改时间↓（最新在前）。
    loadPlaceSort() {
      let pref = null;
      try {
        pref = JSON.parse(
          localStorage.getItem('pan-sort:' + this.placeSortKey()) || 'null');
      } catch (e) {}
      if (pref && (pref.key === 'name' || pref.key === 'size' || pref.key === 'date')
          && (pref.dir === 'asc' || pref.dir === 'desc')) {
        this.sortKey = pref.key;
        this.sortDir = pref.dir;
      } else if (this.activeLocationMount) {
        this.sortKey = 'date';
        this.sortDir = 'desc';
      } else {
        this.sortKey = 'name';
        this.sortDir = 'asc';
      }
    },

    savePlaceSort() {
      try {
        localStorage.setItem('pan-sort:' + this.placeSortKey(),
          JSON.stringify({ key: this.sortKey, dir: this.sortDir }));
      } catch (e) {}
    },

    // 列表头点按：同列反向，不同列按该列默认方向
    //（修改时间默认↓最新在前，名称/大小默认↑）。
    onSortHeader(key) {
      if (this.sortKey === key) {
        this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
      } else {
        this.sortKey = key;
        this.sortDir = key === 'date' ? 'desc' : 'asc';
      }
      this.savePlaceSort();
      this.sortCurrentFiles();
    },

    sortArrow(key) {
      if (this.sortKey !== key) return '';
      return this.sortDir === 'asc' ? '▲' : '▼';
    },

    // 自然排序比较：数字按数值比（第2讲 < 第10讲），不是字典序
    //（第10讲 < 第2讲）。中文按拼音、数字按数值；播放顺序
    // 与文件列表顺序一致，都走这一套。
    naturalCompare(a, b) {
      return String(a).localeCompare(String(b), 'zh', { numeric: true });
    },

    // 与本地列表同一排序规则（fetchFiles / fetchMountFiles /
    // fetchDriveFiles 拉完都调它；缓存命中与后台刷新也调）。
    sortCurrentFiles() {
      const key = this.sortKey;
      const m = this.sortDir === 'asc' ? 1 : -1;
      this.files.sort((a, b) => {
        if (key === 'size') {
          return ((a.size || 0) - (b.size || 0)) * m;
        }
        if (key === 'date') {
          // uploaded 可能是毫秒戳或 ISO 串，统一按时间排；
          // 无大小的原生文档（Drive）按 0 算、无时间按 0 算。
          const ta = new Date(a.uploaded || 0).getTime() || 0;
          const tb = new Date(b.uploaded || 0).getTime() || 0;
          return (ta - tb) * m;
        }
        // 按显示名排：Drive 文件的 key 是文件 id（不是名字），
        // 按 key 排会把顺序打乱。自然排序：数字按数值比，
        // 第2讲 < 第10讲（字典序会排成 第10讲 < 第2讲）。
        return this.naturalCompare(
          this.fileDisplayName(a), this.fileDisplayName(b)) * m;
      });
    },

    // ---- 位置文件夹记忆（IA）----
    // 每位置各自记住所在文件夹：localStorage 键 pan-cwd:<place>；
    // DAV/本地存 cwd 字符串，Drive 存 { folderId, crumbs }。
    // 导航时持续保存（cwd watcher 与 Drive 进出文件夹处调），
    // 切换位置时不再另存——退出保存会与清理顺序打架。
    savePlaceFolder() {
      if (this.shareMode) return;
      try {
        const key = this.placeSortKey();
        if (this.activeDriveMount) {
          localStorage.setItem('pan-cwd:' + key, JSON.stringify({
            folderId: this.driveFolderId,
            crumbs: this.driveCrumbs,
          }));
        } else {
          localStorage.setItem('pan-cwd:' + key, this.cwd || '');
        }
      } catch (e) {}
    },

    readPlaceFolder(placeKey) {
      try {
        const raw = localStorage.getItem('pan-cwd:' + placeKey);
        if (!raw) return '';
        if (placeKey.startsWith('drive:')) {
          const obj = JSON.parse(raw);
          if (obj && typeof obj.folderId === 'string') return obj;
          return '';
        }
        return raw;
      } catch (e) {
        return '';
      }
    },

    // 位置标签栏右缘渐隐（IA §2b）：标签多到横向溢出且未滑到底时
    // 右缘 32px 渐隐，提示后面还有；滑到底后渐隐消失。
    // 调用点：mounted / updated（每次渲染后）/ 横向滚动 / resize。
    updatePlacesFade() {
      const el = this.$refs.placesScroll;
      if (!el) return;
      const more = el.scrollWidth > el.clientWidth + 4
        && el.scrollLeft + el.clientWidth < el.scrollWidth - 4;
      el.classList.toggle('has-more', more);
    },

    // ---- WebDAV 挂载（v1 只读）----
    // 动态脚本加载（html5-qrcode 扫码、qrcodejs 生成分享码均按需加载，
    // 首屏不引入）。
    loadScript(src) {
      return new Promise((resolve, reject) => {
        if (document.querySelector('script[src="' + src + '"]')) {
          resolve();
          return;
        }
        const s = document.createElement('script');
        s.src = src;
        s.onload = () => resolve();
        s.onerror = () => reject(new Error('load_failed'));
        setTimeout(() => reject(new Error('load_timeout')), 15000);
        document.head.appendChild(s);
      });
    },

    // 挂载状态点：ok 绿 / fail 红 / 未测试灰。
    mountDotClass(m) {
      if (!m) return 'loc-dot-idle';
      if (m.lastStatus === 'ok') return 'loc-dot-ok';
      if (m.lastStatus === 'fail') return 'loc-dot-bad';
      return 'loc-dot-idle';
    },

    // 悬停提示（IA 决定）：标题行“显示名 · 状态”，说明行按状态给。
    // 用自定义浮层显示（见 showMountTip），不再挂原生 title 属性
    //（原生 title 手机长按不触发）；两行用 \n 分隔。
    // 具体失败原因只记在当前挂载的 mountLoadError 里，非当前挂载
    // 只给通用失败文案、点进挂载看原因。
    mountTooltip(m) {
      if (!m) return '';
      const isDrive = this.driveMounts.some((d) => d.id === m.id);
      const at = m.lastCheckedAt
        ? new Date(m.lastCheckedAt).toLocaleString()
        : '';
      const timePart = at ? ' · 上次检查 ' + at : '';
      if (m.lastStatus === 'ok') {
        if (isDrive) {
          const acc = m.accountEmail ? ' · 账号 ' + m.accountEmail : '';
          return m.name + ' · 已连接\n已连接' + timePart + acc;
        }
        return m.name + ' · 已连接\n已连接' + timePart;
      }
      if (m.lastStatus === 'fail') {
        const isActive = isDrive
          ? m.id === this.activeDriveMountId
          : m.id === this.activeMountId;
        if (isDrive && isActive) {
          if (this.mountLoadError === 'auth') {
            return m.name + ' · 授权已失效\n授权已失效：请点"重新授权"重新登录 Google';
          }
          if (this.mountLoadError === 'rate') {
            return m.name + ' · 请求太频繁\n请求太频繁，稍后重试';
          }
          if (this.mountLoadError === 'forbidden') {
            return m.name + ' · 无法访问\nGoogle 拒绝了访问：请确认 Drive API 已启用、账号有权限';
          }
          if (this.mountLoadError === 'failed') {
            return m.name + ' · 无法连接\n无法连接 Google：请检查网络（accounts.google.com / googleapis.com 是否可达）';
          }
        }
        return m.name + ' · 连接失败\n连接失败' + timePart + '，点进挂载查看原因';
      }
      return m.name + ' · 未测试\n点"测试"检查连接';
    },

    mountStatusLine(m) {
      const at = m.lastCheckedAt
        ? new Date(m.lastCheckedAt).toLocaleString()
        : '';
      if (m.lastStatus === 'ok') return '已连接' + (at ? ' · 上次检查 ' + at : '');
      if (m.lastStatus === 'fail') {
        return '连接失败' + (at ? ' · 上次检查 ' + at : '');
      }
      return '未测试';
    },

    // ---- 自定义状态提示（替代原生 title）----
    // 内容就是 mountTooltip 的两行文案（标题“显示名 · 状态”+
    // 说明行）；桌面鼠标悬停显示、移开消失；手机长按 600ms 显示、
    // 点别处关闭。原生 title 手机长按不触发，所以另做这一套。
    // 位置：贴在锚点下方，靠近右缘时向左对齐、不出屏幕；
    // 底部放不下时改放锚点上方。
    showMountTip(mount, anchor) {
      const text = this.mountTooltip(mount);
      if (!text || !anchor || !anchor.getBoundingClientRect) return;
      const parts = text.split('\n');
      this.mountTip = {
        show: true,
        title: parts[0] || '',
        detail: parts.slice(1).join('\n') || '',
        dotClass: this.mountDotClass(mount),
        left: 0,
        top: 0,
      };
      this.$nextTick(() => {
        const el = this.$refs.mountTip;
        if (!el) return;
        const r = anchor.getBoundingClientRect();
        const tw = el.offsetWidth;
        const th = el.offsetHeight;
        let left = Math.max(8, Math.min(r.left, window.innerWidth - tw - 8));
        let top = r.bottom + 8;
        if (top + th > window.innerHeight - 8) {
          top = Math.max(8, r.top - th - 8);
        }
        this.mountTip.left = left;
        this.mountTip.top = top;
      });
    },

    hideMountTip() {
      if (this.mountTip.show) this.mountTip.show = false;
    },

    onMountTipTouchStart(mount, e) {
      // 长按 600ms 显示提示；600ms 内松手/取消则不显示。
      // 注意：touchstart 里不能 preventDefault，否则点按会失效。
      this.clearMountTipTimer();
      const anchor = e.currentTarget;
      this.mountTipTimer = setTimeout(() => {
        this.mountTipTimer = null;
        this.mountTipLongPress = true;
        this.showMountTip(mount, anchor);
      }, 600);
    },

    onMountTipTouchEnd() {
      this.clearMountTipTimer();
    },

    clearMountTipTimer() {
      if (this.mountTipTimer) {
        clearTimeout(this.mountTipTimer);
        this.mountTipTimer = null;
      }
    },

    // 当前挂载的有效密码：记密码用存的；不记密码用本次会话内输入的。
    mountPasswordFor(mount) {
      if (!mount) return '';
      if (mount.rememberPassword) return mount.password || '';
      return this.mountSessionPasswords[mount.id] || '';
    },

    // 挂载内文件地址：经代理，带 a 参数（各查看器均为 URL 加载，
    // 无法带请求头；见 dav-mounts.mjs mediaProxyUrl）。
    mountFileUrl(relPath) {
      const mount = this.activeMount;
      if (!mount) return '';
      return mediaProxyUrl(mount, relPath, this.mountPasswordFor(mount));
    },

    goHome() {
      this.exitMount();
      this.exitDriveMount();
      // 回我的网盘：恢复上次离开时所在的文件夹（pan-cwd:local）；
      // 没记过时回根目录（exit* 已拉过根列表，无需再动）。
      const saved = this.readPlaceFolder('local');
      if (saved && this.cwd !== saved) this.cwd = saved;
    },

    exitMount() {
      if (!this.activeMountId) return;
      const wasRoot = this.cwd === '';
      this.clearDavMountState();
      // cwd 已在根目录时 watcher 不触发，这里显式拉一次本地列表。
      if (wasRoot) this.fetchFiles();
    },

    // 清 DAV 挂载状态（不拉列表）：位置切换时用，避免先拉本地列表
    // 再拉挂载列表、两个异步返回互相覆盖。
    clearDavMountState() {
      this.activeMountId = '';
      this.mountStatus = '';
      this.mountLoadError = '';
      clearActiveRef();
      this.cwd = '';
    },

    // 回我的网盘（Drive 侧）：清 Drive 位置与内存里的 access_token，
    // 再拉本地列表。清内存 token = 刷新后 token 即失效，符合 §7.1。
    exitDriveMount() {
      if (!this.activeDriveMountId) return;
      this.clearDriveMountState();
      this.fetchFiles();
    },

    // 清 Drive 挂载状态（不拉列表）：位置切换时用（见 clearDavMountState）。
    clearDriveMountState() {
      this.activeDriveMountId = '';
      this.driveFolderId = 'root';
      this.driveCrumbs = [];
      this.driveNextPageToken = '';
      this.driveAccessToken = '';
      this.mountStatus = '';
      this.mountLoadError = '';
      clearDriveActiveRef();
    },

    switchLocation(id, kind) {
      // 长按只看状态，不切换位置：长按松手后浏览器会补发一次 click，
      // 这里把它拦下来（只清标记、不切换，提示保留、点别处关闭）。
      if (this.mountTipLongPress) {
        this.mountTipLongPress = false;
        return;
      }
      // 正常切换时关掉可能还挂着的悬停提示。
      this.hideMountTip();
      // id 空 = 回我的网盘：两边都清，再拉本地列表。
      if (!id) {
        if (this.activeMountId) this.exitMount();
        else if (this.activeDriveMountId) this.exitDriveMount();
        else this.fetchFiles();
        return;
      }
      if (kind === 'drive') {
        if (id === this.activeDriveMountId) return;
        const mount = this.driveMounts.find((m) => m.id === id);
        if (!mount) return;
        this.clearDavMountState();
        this.enterDriveMount(mount);
        return;
      }
      if (id === this.activeMountId) return;
      const mount = this.davMounts.find((m) => m.id === id);
      if (!mount) return;
      this.clearDriveMountState();
      this.enterMount(mount);
    },

    enterMount(mount) {
      if (this.shareMode) {
        this.showToast('分享查看中不能切换挂载');
        return;
      }
      this.showMountManager = false;
      if (!mount.rememberPassword && !this.mountSessionPasswords[mount.id]) {
        this.openMountPassword(mount);
        return;
      }
      this.activeMountId = mount.id;
      this.mountStatus = '';
      this.mountLoadError = '';
      // 恢复该挂载上次离开时所在的文件夹（pan-cwd:dav:<id>）；
      // 没记过或已被删时回根目录。cwd 已是目标值时 watcher 不触发，
      // 显式拉一次挂载列表。
      const savedCwd = this.readPlaceFolder('dav:' + mount.id);
      const targetCwd = typeof savedCwd === 'string' ? savedCwd : '';
      saveActiveRef(mount.id, targetCwd);
      if (this.cwd !== targetCwd) this.cwd = targetCwd;
      else this.fetchFiles();
    },

    // 记住的文件夹已被删（DAV 侧，PROPFIND 明确 404/410）：
    // 提示并回根目录重拉。只在当前不是根目录时调用；
    // 网络失败、401/403 仍走失败态，不误回落。
    // cwd watcher 会触发 fetchFiles → fetchMountFiles（根）。
    fallbackMountFolderToRoot(mount) {
      try {
        localStorage.removeItem('pan-cwd:dav:' + mount.id);
      } catch (e) {}
      this.showToast('上次的文件夹已被删除，已回到根目录');
      saveActiveRef(mount.id, '');
      this.cwd = '';
    },

    openMountPassword(mount) {
      this.mountPasswordTarget = mount;
      this.mountPasswordInput = '';
      this.mountPasswordError = '';
      this.showMountPassword = true;
      this.$nextTick(() => {
        const el = this.$refs.mountPasswordInput;
        if (el) el.focus();
      });
    },

    async submitMountPassword() {
      const mount = this.mountPasswordTarget;
      if (!mount) return;
      if (!this.mountPasswordInput) {
        this.mountPasswordError = '请输入密码';
        return;
      }
      // 先测一把：密码不对直接报错、不进入。
      const result = await testMountConnection(
        mount, this.mountPasswordInput);
      if (!result.ok) {
        this.mountPasswordError = connectionErrorText(result.error);
        return;
      }
      this.mountSessionPasswords[mount.id] = this.mountPasswordInput;
      this.mountPasswordInput = '';
      this.showMountPassword = false;
      this.mountPasswordTarget = null;
      this.enterMount(mount);
    },

    // 挂载列表拉取：PROPFIND Depth 1 → 解析成 /api/children 同款形状
    // 后复用同一列表渲染。不走 folderCache（挂载可能在别处被改）。
    fetchMountFiles() {
      const mount = this.activeMount;
      if (!mount) {
        this.fetchFiles();
        return;
      }
      if (!mount.rememberPassword && !this.mountSessionPasswords[mount.id]) {
        this.openMountPassword(mount);
        this.loading = false;
        this.navLoading = false;
        return;
      }
      const password = this.mountPasswordFor(mount);
      const relPath = normalizeCwd(this.cwd);
      const hasOld = this.files.length > 0 || this.folders.length > 0;
      this.loading = !hasOld;
      this.navLoading = hasOld;
      this.mountLoadError = '';
      const seq = ++this.fetchSeq;
      davFetch(mount, relPath, { method: 'PROPFIND', depth: 1, password })
        .then(async ({ res, fellBack }) => {
          if (seq !== this.fetchSeq) return;
          if (fellBack) this.showToast('直连被拦，已自动切到中转');
          if (res.status === 401 || res.status === 403) {
            this.mountLoadError = 'auth';
            this.mountStatus = 'fail';
            this.files = [];
            this.folders = [];
            this.loading = false;
            this.navLoading = false;
            if (!mount.rememberPassword) {
              delete this.mountSessionPasswords[mount.id];
              this.openMountPassword(mount);
            }
            return;
          }
          if (res.status === 404 || res.status === 410) {
            // 记住的文件夹已被删（PROPFIND 明确 404/410）：
            // 只有非根路径才回落根目录；根路径 404 = 挂载根本身
            // 没了，走失败态，不误回落。
            if (relPath) {
              this.fallbackMountFolderToRoot(mount);
              return;
            }
            throw new Error('http_' + res.status);
          }
          if (res.status !== 207 && res.status !== 200) {
            throw new Error('http_' + res.status);
          }
          const text = await res.text();
          let rootPrefix = '';
          try {
            rootPrefix = new URL(mount.url).pathname;
          } catch (e) {}
          const data = parsePropfind(text, rootPrefix, relPath);
          this.files = data.value || [];
          this.folders = data.folders || [];
          this.sortCurrentFiles();
          this.mountStatus = 'ok';
          this.mountLoadError = '';
          mount.lastStatus = 'ok';
          mount.lastCheckedAt = Date.now();
          saveMounts(this.davMounts);
          this.loading = false;
          this.navLoading = false;
          this.animateList();
        })
        .catch(() => {
          if (seq !== this.fetchSeq) return;
          this.files = [];
          this.folders = [];
          this.mountLoadError = 'failed';
          this.mountStatus = 'fail';
          this.loading = false;
          this.navLoading = false;
        });
    },

    // ---- Google Drive 挂载（v1 只读）----
    // 拉取当前 Drive 文件夹（§10.2 第 4 点）：files.list 分支，不走
    // 本地 /api/children 与 folderCache。401 已在 driveFetch 里静默
    // 刷新一次、重试后仍 401 才到这里（刷新失败 = 授权失效）。
    async fetchDriveFiles(append) {
      const mount = this.activeDriveMount;
      if (!mount) {
        this.fetchFiles();
        return;
      }
      const hasOld = this.files.length > 0 || this.folders.length > 0;
      this.loading = !hasOld && !append;
      this.navLoading = hasOld && !append;
      this.driveLoadMoreBusy = !!append;
      this.mountLoadError = '';
      const seq = ++this.fetchSeq;
      let pageToken = append ? this.driveNextPageToken : '';
      try {
        const data = await fetchDriveList(mount, this.driveFolderId, pageToken);
        if (seq !== this.fetchSeq) return;
        // 续页时追加（Drive 返回 orderBy folder,name，全量再取会重复），
        // 换文件夹时整页替换。文件/文件夹按 name 再排一次序（续页
        // 与 mock 桩的顺序不保证与 orderBy 一致）。
        if (append) {
          this.files = this.files.concat(data.value || []);
          this.folders = this.folders.concat(data.folders || []);
        } else {
          this.files = data.value || [];
          this.folders = data.folders || [];
        }
        this.driveNextPageToken = data.nextPageToken || '';
        this.sortCurrentFiles();
        this.mountStatus = 'ok';
        this.mountLoadError = '';
        mount.lastStatus = 'ok';
        mount.lastCheckedAt = Date.now();
        saveDriveMounts(this.driveMounts);
        saveDriveActiveRef(mount.id, this.driveFolderId, this.driveCrumbs);
      } catch (e) {
        if (seq !== this.fetchSeq) return;
        const status = e && e.status;
        // 记住的文件夹已被删（files.list 明确 404）：只有非根文件夹
        // 才回落根目录；401/403/429/网络失败仍走失败态，不误回落。
        if (status === 404 && !append && this.driveFolderId !== 'root') {
          try {
            localStorage.removeItem('pan-cwd:drive:' + mount.id);
          } catch (e2) {}
          this.showToast('上次的文件夹已被删除，已回到根目录');
          this.driveFolderId = 'root';
          this.driveCrumbs = [];
          this.driveNextPageToken = '';
          saveDriveActiveRef(mount.id, 'root', []);
          // 递归拉根目录：旧列表先留着（不清空），根拉到之前
          // 只显示顶部加载条，不闪白；新拉取自带序号 guard。
          this.fetchDriveFiles(false);
          return;
        }
        if (!append) {
          this.files = [];
          this.folders = [];
        }
        // §8.2 分层：401 = 授权失效（重新授权）、403 = Drive API 未启
        // 用或无权、429 = 限流、其余 = 网络/上游失败。
        if (status === 401) this.mountLoadError = 'auth';
        else if (status === 403) this.mountLoadError = 'forbidden';
        else if (status === 429) this.mountLoadError = 'rate';
        else this.mountLoadError = 'failed';
        this.mountStatus = 'fail';
        mount.lastStatus = 'fail';
        mount.lastCheckedAt = Date.now();
        saveDriveMounts(this.driveMounts);
      }
      this.loading = false;
      this.navLoading = false;
      this.driveLoadMoreBusy = false;
      if (!append) this.animateList();
    },

    // Drive 续页（列表底部“加载更多”，pageSize=100）。
    loadMoreDriveFiles() {
      if (!this.driveNextPageToken || this.driveLoadMoreBusy) return;
      this.fetchDriveFiles(true);
    },

    // Drive 文件夹内进：push crumbs 栈、换 folderId、拉新列表。
    goInDrive(folderId, folderName) {
      this.driveCrumbs.push({ id: folderId, name: folderName });
      this.driveFolderId = folderId;
      this.driveNextPageToken = '';
      document.title = folderName + ' - FlarePan文件库';
      this.savePlaceFolder();
      this.fetchDriveFiles(false);
    },

    // Drive 返回上级：pop 一层 crumbs，根级时 folderId 回 'root'。
    goUpDrive() {
      if (!this.driveCrumbs.length) return;
      this.driveCrumbs.pop();
      this.driveFolderId =
        this.driveCrumbs.length > 0
          ? this.driveCrumbs[this.driveCrumbs.length - 1].id
          : 'root';
      this.driveNextPageToken = '';
      document.title =
        (this.driveCrumbs.length > 0
          ? this.driveCrumbs[this.driveCrumbs.length - 1].name
          : (this.activeDriveMount && this.activeDriveMount.name) || 'FlarePan文件库') +
        ' - FlarePan文件库';
      this.savePlaceFolder();
      this.fetchDriveFiles(false);
    },

    // Drive 面包屑跳转：点第 i 层 → 截断到该层（-1 = 根目录）。
    goDriveCrumb(index) {
      if (index < 0) {
        this.driveCrumbs = [];
        this.driveFolderId = 'root';
      } else {
        this.driveCrumbs = this.driveCrumbs.slice(0, index + 1);
        this.driveFolderId = this.driveCrumbs[index].id;
      }
      this.driveNextPageToken = '';
      document.title =
        (index >= 0
          ? this.driveCrumbs[index].name
          : (this.activeDriveMount && this.activeDriveMount.name) || 'FlarePan文件库') +
        ' - FlarePan文件库';
      this.savePlaceFolder();
      this.fetchDriveFiles(false);
    },

    // 面包屑点击：Drive 走 driveCrumbs，本地/DAV 走 cwd。
    crumbClick(c) {
      if (this.activeDriveMount) {
        this.goDriveCrumb(c.driveIndex);
        return;
      }
      this.cwd = c.path;
    },

    // 返回上级行：Drive 走 goUpDrive，本地/DAV 走 cwd 去一层。
    onUpRowClick() {
      if (this.activeDriveMount) {
        this.goUpDrive();
        return;
      }
      this.cwd = this.cwd.replace(/[^\/]+\/?$/, '');
    },

    // 文件夹行点击：Drive 文件夹是对象（进子文件夹），本地/DAV
    // 是路径字符串（改 cwd）。
    onFolderClick(folder) {
      if (this.isDriveFolderObj(folder)) {
        this.goInDrive(folder.id, folder.name);
        return;
      }
      this.cwd = folder;
    },

    // 文件夹行右键：Drive v1 只读、无重命名/删除，不开菜单。
    onFolderContextMenu(folder) {
      if (this.isDriveFolderObj(folder)) return;
      this.showContextMenu = true;
      this.focusedItem = folder;
    },

    // Drive 文件夹对象判定：{ id, name } 且当前在 Drive 内。
    isDriveFolderObj(folder) {
      return (
        !!this.activeDriveMount &&
        !!folder &&
        typeof folder === 'object' &&
        typeof folder.id === 'string'
      );
    },

    folderKey(folder) {
      if (folder && typeof folder === 'object') return folder.id || folder.name;
      return folder;
    },

    folderDisplayName(folder) {
      if (folder && typeof folder === 'object') return folder.name || '';
      return String(folder || '').match(/.*?([^/]*)\/?$/)[1] || String(folder || '');
    },

    // 文件行显示名：Drive 文件的 key 是文件 id，显示名走 file.name；
    // 本地/DAV 走 key 的 basename。
    fileDisplayName(file) {
      if (file && file.name) return file.name;
      return (file && file.key ? file.key.split('/').pop() : '') || '';
    },

    // 文件行大小：原生 Google 文档与快捷方式无 size，显示“—”
    // 而不是 0 B；本地/DAV 文件正常格式化。
    fileSizeText(file) {
      if (!file || file.size === undefined || file.size === null) return '—';
      return this.formatSize(file.size);
    },

    // Drive 内容 URL（§10.2 第 9 点）：<img>/<video>/<audio>/
    // <iframe> 与 TextPreview 的 fetch 都带不了 Authorization 头，
    // 所以走 /api/drive-proxy?f=<id>&t=<accessToken>（token 只放
    // URL 查询串、不放 localStorage；refresh_token 绝不进 URL）。
    driveFileUrlFor(file) {
      if (!file) return '';
      return driveFileUrl(file.key, driveExportMime(this.fileContentType(file)));
    },

    // Drive 媒体 URL = 内容 URL + ?t=<accessToken>（打开前先确保
    // token 新鲜，见 openFile 的 Drive 分支）。
    driveMediaUrlFor(file) {
      const base = this.driveFileUrlFor(file);
      if (!base) return '';
      return driveMediaUrl(file.key, this.driveAccessToken, driveExportMime(this.fileContentType(file)));
    },

    // ---- Google Drive 挂载：OAuth 与管理 ----

    // 拉管理员已配置的挂载提供商（GET /api/mounts/providers，公开值）。
    // 失败返回空列表（Drive 页签隐藏，不挡路）；只查一次，打开添加
    // 挂载时再刷新一次。
    async loadMountProviders() {
      if (this.mountProvidersBusy) return;
      this.mountProvidersBusy = true;
      try {
        this.mountProviders = await getMountProviders();
        this.mountProvidersLoaded = true;
      } catch (e) {
        this.mountProviders = [];
      }
      this.mountProvidersBusy = false;
    },

    // 打开添加 Drive 弹窗（Google Drive Tab）：先拉提供商配置。
    openAddDriveMount() {
      this.showMountManager = false;
      this.editingMountId = '';
      this.addDriveName = '';
      this.addDriveError = '';
      this.addDriveBusy = false;
      this.addTab = 'drive';
      this.showAddMount = true;
      this.loadMountProviders();
    },

    // 开始授权（§4.2 第 1–3 步）：生成 PKCE + state，存 pending，
    // 跳 Google 授权页。Client ID 与重定向 URI 取服务端配置
    // （管理后台「挂载」页），前端不再让用户填。
    async startDriveAuth() {
      const provider = this.driveProvider;
      if (!provider) {
        this.addDriveError = '管理员尚未配置 Google Drive，请稍后再试';
        return;
      }
      this.addDriveError = '';
      this.addDriveBusy = true;
      try {
        const verifier = generateCodeVerifier();
        const challenge = await generateCodeChallenge(verifier);
        const state = generateState();
        const redirectUri = provider.redirect_uri || (window.location.origin + '/');
        saveOAuthPending({
          state,
          codeVerifier: verifier,
          redirectUri,
          name: String(this.addDriveName || '').trim(),
          reauthMountId: this.driveReauthMount ? this.driveReauthMount.id : '',
        });
        const url = buildAuthUrl({ clientId: provider.client_id, redirectUri, codeChallenge: challenge, state });
        window.location.href = url;
      } catch (e) {
        this.addDriveError = '无法发起授权：' + (e && e.message ? e.message : '未知错误');
        this.addDriveBusy = false;
      }
    },

    // 授权回调接应（§4.2 第 4–5 步）：Google 跳回 ?code=…&state=…。
    // state 对不上 → 拒绝（防 CSRF）；对上 → Worker 换 token，
    // 建挂载（或给旧挂载换 token），进挂载，URL 参数清掉。
    async handleDriveCallback() {
      const url = new URL(window.location);
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      const error = url.searchParams.get('error');
      if (!code && !error) return;
      // 只有正在走 Drive OAuth 授权时 ?code= 才是授权回调。没有待处理
      // 的授权流程时（例如分享页的 ?code= 提取码），不要碰 URL 参数，
      // 留给分享页自动解锁用；也不要弹 state 不匹配的提示。
      const pending = loadOAuthPending();
      if (!pending) return;
      const errorDesc = url.searchParams.get('error_description') || '';
      // 不管成功失败都先清掉 URL 参数（code 只能用一次，留在地址
      // 栏里刷新会重放）。
      url.searchParams.delete('code');
      url.searchParams.delete('state');
      url.searchParams.delete('error');
      url.searchParams.delete('error_description');
      window.history.replaceState(null, '', url.toString());
      if (error) {
        this.showToast('Google 授权被拒绝：' + (errorDesc || error));
        return;
      }
      if (pending.state !== state) {
        this.showToast('授权回调校验失败（state 不匹配），请重新授权');
        return;
      }
      clearOAuthPending();
      try {
        const token = await exchangeCode({
          code,
          codeVerifier: pending.codeVerifier,
          redirectUri: pending.redirectUri,
        });
        if (pending.reauthMountId) {
          // 重新授权：只换 token（Google 有 prompt=consent，每次都
          // 给新 refresh_token；万一没给就沿用旧的），不改名。
          const mount = this.driveMounts.find((m) => m.id === pending.reauthMountId);
          if (mount) {
            mount.refreshToken = token.refreshToken || mount.refreshToken;
            saveDriveMounts(this.driveMounts);
            if (token.accessToken) {
              setAccessToken(mount.id, token.accessToken, token.expiresIn || 3600);
            }
            this.driveReauthMount = null;
            this.showToast('重新授权成功');
            this.enterDriveMount(mount);
            return;
          }
        }
        // 新挂载：先建挂载（id 固定），再用它调 about 拿账号名/邮箱
        // 当默认名（about 的 token 存在该挂载名下，不浪费一次刷新）。
        const mount = normalizeDriveMount({
          name: pending.name || 'Google Drive',
          refreshToken: token.refreshToken,
        });
        if (token.accessToken) {
          setAccessToken(mount.id, token.accessToken, token.expiresIn || 3600);
        }
        this.driveMounts.push(mount);
        saveDriveMounts(this.driveMounts);
        try {
          const about = await fetchDriveAbout(mount);
          mount.accountName = about.accountName || '';
          mount.accountEmail = about.accountEmail || '';
          mount.accountPhoto = about.accountPhoto || '';
          if (!pending.name && about.accountName) mount.name = about.accountName;
          saveDriveMounts(this.driveMounts);
        } catch (e) {}
        this.showToast('Google Drive 已连接');
        this.enterDriveMount(mount);
      } catch (e) {
        this.showToast('授权失败：' + (e && e.message ? e.message : '未知错误'));
      }
    },

    // 进入 Drive 挂载：无 refresh_token 时走重新授权；有则进根目录拉列表。
    enterDriveMount(mount) {
      if (this.shareMode) {
        this.showToast('分享查看中不能切换挂载');
        return;
      }
      this.showMountManager = false;
      if (!mount.refreshToken) {
        this.driveReauthMount = mount;
        this.showToast('该挂载未授权，请重新授权');
        this.openAddDriveMount();
        return;
      }
      this.activeDriveMountId = mount.id;
      this.mountStatus = '';
      this.mountLoadError = '';
      // 恢复该挂载上次离开时所在的文件夹（pan-cwd:drive:<id>）；
      // 没记过时回根目录。
      const savedDrive = this.readPlaceFolder('drive:' + mount.id);
      if (savedDrive && savedDrive.folderId) {
        this.driveFolderId = savedDrive.folderId;
        this.driveCrumbs = Array.isArray(savedDrive.crumbs)
          ? savedDrive.crumbs : [];
      } else {
        this.driveFolderId = 'root';
        this.driveCrumbs = [];
      }
      this.driveNextPageToken = '';
      document.title = mount.name + ' - FlarePan文件库';
      saveDriveActiveRef(mount.id, this.driveFolderId, this.driveCrumbs);
      this.fetchDriveFiles(false);
    },

    // 测试 Drive 挂载：调 about（§9.2），成功显示账号名/邮箱。
    async testDriveMount(mount) {
      this.driveTestResults = {
        ...this.driveTestResults,
        [mount.id]: '测试中…',
      };
      try {
        const about = await fetchDriveAbout(mount);
        mount.accountName = about.accountName || '';
        mount.accountEmail = about.accountEmail || '';
        mount.accountPhoto = about.accountPhoto || '';
        mount.lastStatus = 'ok';
        mount.lastCheckedAt = Date.now();
        saveDriveMounts(this.driveMounts);
        this.driveTestResults = {
          ...this.driveTestResults,
          [mount.id]: '测试成功：' + (about.accountName || about.accountEmail || '已连接'),
        };
      } catch (e) {
        mount.lastStatus = 'fail';
        mount.lastCheckedAt = Date.now();
        saveDriveMounts(this.driveMounts);
        const status = e && e.status;
        this.driveTestResults = {
          ...this.driveTestResults,
          [mount.id]: status === 401
            ? '测试失败：授权已失效，请重新授权'
            : status === 403
              ? '测试失败：Google 拒绝了访问（Drive API 未启用或无权限）'
              : status === 429
                ? '测试失败：请求太频繁，稍后重试'
                : '测试失败：无法连接 Google，请检查网络',
        };
      }
    },

    // 重新授权（§9.3）：走一遍 §4.2，拿新 token；旧 refresh_token
    // 在新 token 到手后才换（见 handleDriveCallback）。
    reauthDriveMount(mount) {
      if (!mount) return;
      this.driveReauthMount = mount;
      this.addDriveName = mount.name || '';
      this.addDriveError = '';
      this.showMountManager = false;
      this.addTab = 'drive';
      this.showAddMount = true;
      this.loadMountProviders();
    },

    // 删除 Drive 挂载：先吊销 refresh_token（revoke 不需要 secret，
    // 浏览器直发；失败不阻塞），再清内存 token 与本地记录。
    async deleteDriveMount(mount) {
      if (!mount) return;
      this.driveDeleteArmed = '';
      try {
        await revokeDriveToken(mount.refreshToken);
      } catch (e) {}
      clearAccessToken(mount.id);
      this.driveMounts = this.driveMounts.filter((m) => m.id !== mount.id);
      saveDriveMounts(this.driveMounts);
      if (this.activeDriveMountId === mount.id) {
        this.clearDriveMountState();
        this.fetchFiles();
      }
      this.showToast('已删除挂载');
    },

    openMountManager() {
      this.showMountManager = true;
      this.mountDeleteArmed = '';
      this.driveDeleteArmed = '';
    },

    // ---- WebDAV 挂载二阶段（上传 / 新建 / 重命名 / 删除 / 文本编辑）----
    // 文件名校验（前端先拦，不发请求）：去首尾空白；拒绝空、.、..；
    // 拒绝 / \ 与控制字符。其它字符（空格、中文、括号等）放行。
    validMountName(name) {
      const n = String(name || '').trim();
      if (!n) return '名称不能为空';
      if (n === '.' || n === '..') return '名称不能是 . 或 ..';
      if (/[/\\]/.test(n)) return '名称不能包含 / 或 \\';
      // eslint-disable-next-line no-control-regex
      if (/[\x00-\x1f\x7f]/.test(n)) return '名称不能包含控制字符';
      return '';
    },

    // 挂载内某路径是否存在（PROPFIND Depth 0；200/207 = 存在）。
    async mountPathExists(relPath) {
      const mount = this.activeMount;
      if (!mount) return false;
      try {
        const { res } = await davFetch(mount, relPath, {
          method: 'PROPFIND',
          depth: 0,
          password: this.mountPasswordFor(mount),
        });
        return res.status === 200 || res.status === 207;
      } catch (e) {
        return false;
      }
    },

    // 同名时自动改名：name.ext → name (1).ext → name (2).ext…直到不重名。
    async findFreeMountName(relPath) {
      const slash = relPath.lastIndexOf('/');
      const dir = slash >= 0 ? relPath.slice(0, slash + 1) : '';
      const base = slash >= 0 ? relPath.slice(slash + 1) : relPath;
      const dot = base.lastIndexOf('.');
      const stem = dot > 0 ? base.slice(0, dot) : base;
      const ext = dot > 0 ? base.slice(dot) : '';
      for (let i = 1; i <= 100; i++) {
        const candidate = dir + stem + ' (' + i + ')' + ext;
        if (!(await this.mountPathExists(candidate))) return candidate;
      }
      return null;
    },

    // ---------------- 新建菜单（列表头右端玻璃「＋ 新建」钮） ----------------
    toggleCreateMenu() {
      if (!this.activeMount || this.shareMode) return;
      this.showCreateMenu = !this.showCreateMenu;
    },
    pickCreate(kind) {
      this.showCreateMenu = false;
      if (kind === 'upload') this.triggerMountUpload();
      else if (kind === 'mkdir') this.openMkdirDialog();
    },

    // ---------------- 上传 ----------------
    triggerMountUpload() {
      if (!this.activeMount || this.shareMode) return;
      const el = this.$refs.mountFileInput;
      if (el) {
        el.value = '';
        el.click();
      }
    },

    onMountFilePicked(e) {
      const files = e && e.target && e.target.files
        ? Array.from(e.target.files)
        : [];
      if (files.length) this.enqueueMountUploads(files);
    },

    enqueueMountUploads(fileList) {
      if (!this.activeMount || this.shareMode) return;
      const cwd = normalizeCwd(this.cwd);
      for (const file of fileList) {
        this.mountUploads.push({
          id: 'u-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8),
          name: file.name,
          file,
          relPath: cwd ? cwd + '/' + file.name : file.name,
          status: 'queued',
          loaded: 0,
          total: file.size || 0,
          error: '',
          controller: null,
        });
      }
      if (!this.uploadQueueRunning) this.processUploadQueue();
    },

    // 顺序上传，一次一个；整批结束才刷新一次列表（不逐文件刷，防闪烁）。
    async processUploadQueue() {
      if (this.uploadQueueRunning) return;
      this.uploadQueueRunning = true;
      try {
        for (;;) {
          const item = this.mountUploads.find((u) => u.status === 'queued');
          if (!item) break;
          await this.uploadOneMountFile(item);
        }
      } finally {
        this.uploadQueueRunning = false;
        const done = this.mountUploads.filter((u) => u.status === 'done').length;
        if (done) {
          this.fetchMountFiles();
          this.showToast('已上传 ' + done + ' 个文件');
        }
      }
    },

    async uploadOneMountFile(item) {
      const mount = this.activeMount;
      if (!mount) {
        item.status = 'failed';
        item.error = '未在挂载内';
        return;
      }
      // 1. 先拦超大（不发请求）。
      if (item.file.size > DAV_MAX_UPLOAD_MB * 1024 * 1024) {
        item.status = 'failed';
        item.error = '「' + item.name + '」为 ' + this.formatSize(item.file.size) +
          '，超过单文件 ' + DAV_MAX_UPLOAD_MB + 'MB 上限，无法经中转上传。';
        return;
      }
      // 2. 查同名（PROPFIND Depth 0）。存在时按批量选择或弹 Dialog。
      if (await this.mountPathExists(item.relPath)) {
        let choice = this.uploadBatchChoice;
        if (!choice) choice = await this.waitUploadConflict(item);
        if (choice === 'cancel') {
          item.status = 'cancelled';
          return;
        }
        if (choice === 'rename') {
          const free = await this.findFreeMountName(item.relPath);
          if (!free) {
            item.status = 'failed';
            item.error = '找不到不重名的文件名';
            return;
          }
          item.relPath = free;
          item.name = free.split('/').pop();
        }
        // overwrite：直接 PUT 覆盖（PUT 是幂等的）。
      }
      // 3. PUT 上传（XHR 做进度）。
      item.status = 'uploading';
      item.loaded = 0;
      item.error = '';
      const controller = new AbortController();
      item.controller = controller;
      try {
        const { status, fellBack } = await davUploadXhr(mount, item.relPath, item.file, {
          password: this.mountPasswordFor(mount),
          signal: controller.signal,
          onProgress: (loaded, total) => {
            item.loaded = loaded;
            if (total) item.total = total;
          },
        });
        if (fellBack) this.showToast('直连被拦，已自动切到中转');
        if (status === 200 || status === 201 || status === 204) {
          item.status = 'done';
          item.loaded = item.total;
        } else if (status === 413) {
          item.status = 'failed';
          item.error = '文件超过单文件 ' + DAV_MAX_UPLOAD_MB + 'MB 上限，无法经中转上传';
        } else {
          item.status = 'failed';
          item.error = davErrorText(status, 'PUT');
        }
      } catch (e) {
        if (e && e.name === 'AbortError') {
          item.status = 'cancelled';
          item.error = '已取消，服务器上可能留有不完整的文件，重新上传会覆盖它';
        } else {
          item.status = 'failed';
          item.error = '服务器无响应，请稍后重试';
        }
      } finally {
        item.controller = null;
      }
    },

    // 同名冲突：弹 Dialog，等用户选（覆盖 / 改名上传 / 取消）。
    waitUploadConflict(item) {
      return new Promise((resolve) => {
        this.uploadConflict = { item, applyToAll: false };
        this.uploadConflictResolve = resolve;
      });
    },

    resolveUploadConflict(choice) {
      if (!this.uploadConflict) return;
      if (this.uploadConflict.applyToAll) this.uploadBatchChoice = choice;
      const resolve = this.uploadConflictResolve;
      this.uploadConflict = null;
      this.uploadConflictResolve = null;
      if (resolve) resolve(choice);
    },

    retryMountUpload(item) {
      // 重试就是重新 PUT 同一路径（PUT 幂等，覆盖上次的半文件即修复）。
      item.status = 'queued';
      item.loaded = 0;
      item.error = '';
      if (!this.uploadQueueRunning) this.processUploadQueue();
    },

    cancelMountUpload(item) {
      if (item.controller) {
        item.controller.abort();
        return;
      }
      if (item.status === 'queued') item.status = 'cancelled';
    },

    clearFinishedUploads() {
      this.mountUploads = this.mountUploads.filter(
        (u) => u.status === 'queued' || u.status === 'uploading' || u.status === 'failed');
    },

    uploadPercent(u) {
      if (!u.total) return u.status === 'done' ? 100 : 0;
      return Math.min(100, Math.round(((u.loaded || 0) / u.total) * 100));
    },

    uploadStateText(u) {
      if (u.status === 'done') return '已完成';
      if (u.status === 'failed') return '失败：' + (u.error || '上传失败');
      if (u.status === 'cancelled') return '已取消';
      if (u.status === 'uploading') return this.uploadPercent(u) + '%';
      return '等待中';
    },

    // ---------------- 拖拽上传 ----------------
    onMountDragEnter(e) {
      if (!this.activeMount || this.shareMode) return;
      const items = e.dataTransfer && e.dataTransfer.items;
      let hasFile = false;
      if (items) {
        for (let i = 0; i < items.length; i++) {
          if (items[i].kind === 'file') { hasFile = true; break; }
        }
      } else if (e.dataTransfer && e.dataTransfer.types) {
        hasFile = Array.from(e.dataTransfer.types).includes('Files');
      }
      if (!hasFile) return;
      this.dragDepth += 1;
      this.dragOver = true;
      const files = e.dataTransfer.files;
      if (files && files.length) this.dragFileCount = files.length;
    },

    onMountDragLeave() {
      if (this.dragDepth > 0) this.dragDepth -= 1;
      if (this.dragDepth <= 0) {
        this.dragDepth = 0;
        this.dragOver = false;
        this.dragFileCount = 0;
      }
    },

    onMountDrop(e) {
      if (!this.activeMount || this.shareMode) return;
      e.preventDefault();
      this.dragDepth = 0;
      this.dragOver = false;
      this.dragFileCount = 0;
      const files = e.dataTransfer && e.dataTransfer.files
        ? Array.from(e.dataTransfer.files)
        : [];
      // 第一期只取其中的文件平铺上传到当前目录（目录结构不保留；
      // 目录递归上传列为后续优化）。
      if (files.length) this.enqueueMountUploads(files);
    },

    // ---------------- 新建文件夹 ----------------
    openMkdirDialog() {
      if (!this.activeMount || this.shareMode) return;
      this.mkdirName = '';
      this.mkdirError = '';
      this.mkdirBusy = false;
      this.showMkdirDialog = true;
      this.$nextTick(() => {
        const el = this.$refs.mkdirInput;
        if (el) el.focus();
      });
    },

    async submitMkdir() {
      const mount = this.activeMount;
      if (!mount || this.mkdirBusy) return;
      const err = this.validMountName(this.mkdirName);
      if (err) {
        this.mkdirError = err;
        return;
      }
      const name = this.mkdirName.trim();
      const cwd = normalizeCwd(this.cwd);
      const relPath = cwd ? cwd + '/' + name : name;
      this.mkdirBusy = true;
      this.mkdirError = '';
      const result = await davMkcol(mount, relPath, {
        password: this.mountPasswordFor(mount),
      });
      this.mkdirBusy = false;
      if (result.ok) {
        this.showMkdirDialog = false;
        this.fetchMountFiles();
        // 建文件夹通常就是为了马上往里放东西：直接进入新建的文件夹。
        // cwd 保持文件夹键的形态（带尾斜杠），否则「返回上级目录」的
        // 正则 /[^/]+\/$/ 匹配不到、点按无反应。
        this.cwd = relPath + '/';
        this.showToast('已新建文件夹「' + name + '」');
      } else if (result.status === 405) {
        this.mkdirError = '已存在同名文件夹或文件';
      } else {
        this.mkdirError = davErrorText(result.status, 'MKCOL');
      }
    },

    // ---------------- 重命名（MOVE，同目录内，永不覆盖）----------------
    openRenameDialog(item) {
      if (!this.activeMount || this.shareMode) return;
      this.showContextMenu = false;
      this.renameTarget = item;
      this.renameError = '';
      this.renameBusy = false;
      const isFolder = typeof item === 'string';
      const rel = isFolder ? item.replace(/\/+$/, '') : item.key;
      const base = rel.split('/').pop();
      this.renameName = base;
      this.showRenameDialog = true;
      this.$nextTick(() => {
        const el = this.$refs.renameInput;
        if (!el) return;
        el.focus();
        // 光标选中除扩展名外的部分（改错扩展名是常见失误；用户仍可全选改掉）。
        const dot = base.lastIndexOf('.');
        const stemLen = !isFolder && dot > 0 ? dot : base.length;
        try {
          el.setSelectionRange(0, stemLen);
        } catch (e) {}
      });
    },

    async submitRename() {
      const mount = this.activeMount;
      if (!mount || this.renameBusy || !this.renameTarget) return;
      const isFolder = typeof this.renameTarget === 'string';
      const oldRel = (isFolder
        ? this.renameTarget.replace(/\/+$/, '')
        : this.renameTarget.key);
      const err = this.validMountName(this.renameName);
      if (err) {
        this.renameError = err;
        return;
      }
      const newName = this.renameName.trim();
      if (newName === oldRel.split('/').pop()) {
        this.showRenameDialog = false;
        return;
      }
      const slash = oldRel.lastIndexOf('/');
      const newRel = slash >= 0
        ? oldRel.slice(0, slash + 1) + newName
        : newName;
      this.renameBusy = true;
      this.renameError = '';
      const result = await davMove(mount, oldRel, newRel, 'F', {
        password: this.mountPasswordFor(mount),
      });
      this.renameBusy = false;
      if (result.ok) {
        this.showRenameDialog = false;
        this.fetchMountFiles();
        this.showToast('已重命名为「' + newName + '」');
      } else if (result.status === 412) {
        this.renameError = '已存在同名文件，换个名字';
      } else {
        this.renameError = davErrorText(result.status, 'MOVE');
      }
    },

    // ---------------- 删除（DELETE，二次确认，不可恢复）----------------
    async openDeleteDialog(item) {
      if (!this.activeMount || this.shareMode) return;
      this.showContextMenu = false;
      this.deleteTarget = item;
      this.deleteBusy = false;
      const isFolder = typeof item === 'string';
      const name = isFolder
        ? item.replace(/\/+$/, '').split('/').pop()
        : item.key.split('/').pop();
      if (!isFolder) {
        this.deleteText = '确定删除「' + name + '」吗？删除后无法恢复。';
        this.showDeleteDialog = true;
        return;
      }
      // 文件夹：先取子项数，写进确认文案；取不到时不写数字，只写“全部内容”。
      let countText = '';
      try {
        const { res } = await davFetch(this.activeMount, item.replace(/\/+$/, ''), {
          method: 'PROPFIND',
          depth: 1,
          password: this.mountPasswordFor(this.activeMount),
        });
        if (res.status === 207 || res.status === 200) {
          const text = await res.text();
          const rootPrefix = (() => {
            try { return new URL(this.activeMount.url).pathname; } catch (e) { return ''; }
          })();
          const data = parsePropfind(text, rootPrefix, item.replace(/\/+$/, ''));
          const n = (data.value || []).length + (data.folders || []).length;
          if (n > 0) countText = '（共 ' + n + ' 项）';
        }
      } catch (e) {}
      this.deleteText = '确定删除文件夹「' + name + '」吗？文件夹内的全部内容' +
        countText + '将一并删除，删除后无法恢复。';
      this.showDeleteDialog = true;
    },

    async submitDelete() {
      const mount = this.activeMount;
      if (!mount || this.deleteBusy || !this.deleteTarget) return;
      const isFolder = typeof this.deleteTarget === 'string';
      const rel = isFolder
        ? this.deleteTarget.replace(/\/+$/, '')
        : this.deleteTarget.key;
      const name = rel.split('/').pop();
      this.deleteBusy = true;
      const result = await davDelete(mount, rel, {
        password: this.mountPasswordFor(mount),
      });
      this.deleteBusy = false;
      if (result.ok) {
        this.showDeleteDialog = false;
        // 删的是正在播放/预览的文件时，顺带清掉播放队列与各预览器。
        this.clearDeletedFromPlayers(rel);
        this.fetchMountFiles();
        this.showToast('已删除「' + name + '」');
      } else {
        this.showDeleteDialog = false;
        this.showToast(davErrorText(result.status, 'DELETE'));
      }
    },

    // 删掉的文件若正在播放/预览，清掉它（否则播放器下一首会 404）。
    clearDeletedFromPlayers(rel) {
      const key = this.activeMountId + ':' + rel;
      this.playerQueue = this.playerQueue.filter((q) => q.key !== key);
      if (this.videoUrl && this.videoName === rel.split('/').pop()) {
        this.closeVideo();
      }
      if (this.textUrl && this.textEditFile && this.textEditFile.key === rel) {
        this.closeText();
      }
      if (this.pdfUrl && this.pdfName === rel.split('/').pop()) {
        this.closePdf();
      }
      if (this.imageList.length) {
        this.imageList = this.imageList.filter((im) => im.key !== rel);
        if (!this.imageList.length) this.closeImage();
      }
      if (this.infoFile && this.infoFile.key === rel) this.closeInfo();
    },

    // ---------------- 文本内容编辑（TextPreview + PUT 覆盖）----------------
    async saveMountText(newText) {
      const mount = this.activeMount;
      const file = this.textEditFile;
      if (!mount || !file || this.textSaving) return;
      this.textSaving = true;
      try {
        // 1. 冲突检测：PROPFIND Depth 0 取当前 ETag/大小/修改时间，
        //    与编辑开始时比对。变了就弹冲突框（默认以服务器为准）。
        let current = null;
        let propfindFailed = false;
        try {
          const { res } = await davFetch(mount, file.key, {
            method: 'PROPFIND',
            depth: 0,
            password: this.mountPasswordFor(mount),
          });
          if (res.status === 404) {
            current = 'gone';
          } else if (res.status === 200 || res.status === 207) {
            current = parsePropfindOne(await res.text());
          } else {
            propfindFailed = true;
          }
        } catch (e) {
          propfindFailed = true;
        }
        if (current === 'gone') {
          const ok = await this.waitTextConflict({
            detail: '「' + file.key.split('/').pop() + '」已被删除。重新创建它，还是放弃？',
            overwriteLabel: '重新创建',
            discardLabel: '放弃，不创建',
            pendingText: newText,
          });
          if (!ok) return;
        } else if (!propfindFailed && current) {
          const etagChanged = this.textEditEtag && current.etag &&
            current.etag !== this.textEditEtag;
          const sizeChanged = current.size !== this.textEditSize;
          const mtimeChanged = this.textEditUploaded && current.uploaded &&
            current.uploaded !== this.textEditUploaded;
          if (etagChanged || sizeChanged || mtimeChanged) {
            const ok = await this.waitTextConflict({
              detail: '「' + file.key.split('/').pop() +
                '」已被改过（另一台设备或他人），以服务器上的版本为准。',
              overwriteLabel: '用我的版本覆盖',
              discardLabel: '放弃我的修改，重新加载',
              pendingText: newText,
            });
            if (!ok) {
              // 放弃：丢弃编辑，重新拉取并回到查看态。
              this.closeText();
              this.$nextTick(() => this.openFile(file));
              return;
            }
          }
        }
        // 2. PUT 覆盖原路径（带 If-Match：上游支持条件写时会回 412，
        //    与 PROPFIND 比对互相印证；以 PROPFIND 比对为准）。
        const body = newText;
        const bytes = new TextEncoder().encode(body).length;
        const headers = {};
        if (this.textEditEtag) headers['If-Match'] = this.textEditEtag;
        const result = await davPut(mount, file.key, body, {
          contentType: /\.md$/i.test(file.key)
            ? 'text/markdown; charset=utf-8'
            : 'text/plain; charset=utf-8',
          contentLength: bytes,
          password: this.mountPasswordFor(mount),
          headers,
        });
        if (result.ok) {
          this.fetchMountFiles();
          this.showToast('已保存');
          // 重新加载查看态（:key 强制 TextPreview 重新拉取全文）。
          this.textKey += 1;
          // 基线更新为刚保存的内容：大小 = 新文本字节数；ETag 与修改时间
          // 未知，置空表示下次比对时跳过这两项（只比大小）。
          this.textEditSize = bytes;
          this.textEditEtag = '';
          this.textEditUploaded = '';
        } else if (result.status === 412) {
          const ok = await this.waitTextConflict({
            detail: '「' + file.key.split('/').pop() +
              '」已被改过（另一台设备或他人），以服务器上的版本为准。',
            overwriteLabel: '用我的版本覆盖',
            discardLabel: '放弃我的修改，重新加载',
            pendingText: newText,
          });
          if (ok) {
            // 覆盖：这次不带 If-Match 再 PUT 一次。
            const retry = await davPut(mount, file.key, body, {
              contentType: /\.md$/i.test(file.key)
                ? 'text/markdown; charset=utf-8'
                : 'text/plain; charset=utf-8',
              contentLength: bytes,
              password: this.mountPasswordFor(mount),
            });
            if (retry.ok) {
              this.fetchMountFiles();
              this.showToast('已保存');
              this.textKey += 1;
              this.textEditSize = bytes;
              this.textEditEtag = '';
              this.textEditUploaded = '';
            } else {
              this.showToast(davErrorText(retry.status, 'PUT'));
            }
          } else {
            this.closeText();
            this.$nextTick(() => this.openFile(file));
          }
        } else {
          this.showToast(davErrorText(result.status, 'PUT'));
        }
      } finally {
        this.textSaving = false;
      }
    },

    // 文本冲突框：等用户选（true = 用我的版本覆盖，false = 放弃）。
    waitTextConflict(info) {
      return new Promise((resolve) => {
        this.textConflict = info;
        this.textConflictResolve = resolve;
      });
    },

    resolveTextConflict(overwrite) {
      if (!this.textConflict) return;
      const resolve = this.textConflictResolve;
      this.textConflict = null;
      this.textConflictResolve = null;
      if (resolve) resolve(overwrite);
    },

    openAddMount() {
      this.editingMountId = '';
      this.resetAddForm();
      this.showMountManager = false;
      this.showAddMount = true;
      // 打开添加挂载时拉一次提供商配置，决定 Drive 页签显不显示。
      this.loadMountProviders();
    },

    openEditMount(mount) {
      this.editingMountId = mount.id;
      this.addTab = 'manual';
      this.addName = mount.name;
      this.addUrl = mount.url;
      this.addUser = mount.username;
      this.addPass = mount.password;
      this.addShowPass = false;
      this.addRemember = mount.rememberPassword;
      this.addMode = mount.mode;
      this.addError = '';
      this.addTestResult = '';
      this.showAddMount = true;
    },

    resetAddForm() {
      this.addTab = 'scan';
      this.addName = '';
      this.addUrl = '';
      this.addUser = '';
      this.addPass = '';
      this.addShowPass = false;
      this.addRemember = true;
      this.addMode = 'proxy';
      this.addBusy = false;
      this.addError = '';
      this.addTestResult = '';
      this.resetScan();
    },

    onAddMountToggle(v) {
      if (!v) {
        this.stopScan();
        this.showAddMount = false;
      } else {
        this.showAddMount = true;
      }
    },

    switchAddTab(tab) {
      if (tab !== 'scan') this.stopScan();
      this.addTab = tab;
      // 切到 Drive Tab 时拉一次提供商配置（只拉一次，之后靠
      // addDriveError 反馈）；未配置时该页签根本不渲染。
      if (tab === 'drive') this.loadMountProviders();
    },

    resetScan() {
      this.stopScan();
      this.scanState = '';
      this.scanError = '';
      this.scanPaste = '';
      this.parsedMount = null;
      this.parsedSource = '';
    },

    async startScan() {
      this.scanError = '';
      let ok = false;
      try {
        await this.loadScript(
          'https://cdn.jsdelivr.net/npm/html5-qrcode@2.3.8/html5-qrcode.min.js'
        );
        ok = !!window.Html5Qrcode;
      } catch (e) {
        ok = false;
      }
      if (!ok) {
        this.scanError = '扫码组件加载失败，请改用相册或粘贴';
        return;
      }
      this.scanState = 'scanning';
      await this.$nextTick();
      try {
        const reader = new window.Html5Qrcode('dav-scan-reader');
        this._scanReader = reader;
        await reader.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: 250 },
          (text) => {
            this.handleScannedText(text);
          },
          () => {}
        );
      } catch (e) {
        this.scanState = 'error';
        this.scanError = '无法打开相机，请检查权限，或改用相册 / 粘贴';
        this._scanReader = null;
      }
    },

    async stopScan() {
      const reader = this._scanReader;
      this._scanReader = null;
      if (!reader) return;
      try {
        await reader.stop();
      } catch (e) {}
      try {
        reader.clear();
      } catch (e) {}
      if (this.scanState === 'scanning') this.scanState = '';
    },

    async onScanFile(e) {
      const file = e.target && e.target.files && e.target.files[0];
      if (e.target) e.target.value = '';
      if (!file) return;
      // 优先用 jsQR（纯解码、不依赖 DOM 元素、轻量）；
      // 失败再走 Html5Qrcode 实例的 scanFile 兜底。
      // 注意：html5-qrcode 2.3.8 的 scanFile 是实例方法，不是静态方法
      // （2026-11-14 实测：Html5Qrcode.scanFile 直接调会报 not a function）。
      let text = '';
      try {
        text = await this.decodeQrFileWithJsQr(file);
      } catch (err) {
        text = '';
      }
      if (!text) {
        try {
          await this.loadScript(
            'https://cdn.jsdelivr.net/npm/html5-qrcode@2.3.8/html5-qrcode.min.js'
          );
          if (window.Html5Qrcode) {
            const reader = new window.Html5Qrcode('dav-scan-reader');
            try {
              text = await reader.scanFile(file, false);
            } finally {
              try {
                await reader.clear();
              } catch (err2) {}
            }
          }
        } catch (err) {
          text = '';
        }
      }
      if (text) {
        this.handleScannedText(text);
      } else {
        this.scanError = '图片中没有识别出二维码，请改用粘贴';
      }
    },

    // 用 jsQR 解相册图片里的二维码：图片画到 canvas 取像素再解码。
    async decodeQrFileWithJsQr(file) {
      await this.loadScript(
        'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js'
      );
      if (!window.jsQR) throw new Error('jsQR not loaded');
      const url = URL.createObjectURL(file);
      try {
        const img = await new Promise((resolve, reject) => {
          const im = new Image();
          im.onload = () => resolve(im);
          im.onerror = () => reject(new Error('image load failed'));
          im.src = url;
        });
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0);
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = window.jsQR(data.data, data.width, data.height);
        return code && code.data ? code.data : '';
      } finally {
        URL.revokeObjectURL(url);
      }
    },

    handleScannedText(text) {
      this.stopScan();
      const result = parseDavQr(text);
      if (!result.ok) {
        this.scanState = 'error';
        this.scanError = qrParseErrorText(result.error);
        return;
      }
      this.parsedMount = result.mount;
      this.parsedSource = result.source;
      this.scanState = 'parsed';
      this.scanError = '';
    },

    parsePastedQr() {
      this.handleScannedText(this.scanPaste);
    },

    // 猫头鹰二维码 → 手动添加：地址与用户名已解析出，直接填进
    // 手动表单（密码留空，用户自己填 Cloudreve 设置里的 WebDAV 密码），
    // 切到手动 Tab。解析出的加密密码绝不带过去。
    goManualFromOwl() {
      if (this.parsedMount) {
        this.addName = this.parsedMount.name || '';
        this.addUrl = this.parsedMount.url || '';
        this.addUser = this.parsedMount.username || '';
        this.addPass = '';
      }
      this.addError = '';
      this.addTestResult = '';
      this.resetScan();
      this.switchAddTab('manual');
    },

    saveParsedMount() {
      if (!this.parsedMount) return;
      const mount = normalizeMount({
        ...this.parsedMount,
        rememberPassword: this.addRemember,
        mode: this.addMode,
      });
      this.davMounts.push(mount);
      saveMounts(this.davMounts);
      this.showAddMount = false;
      this.resetScan();
      this.showToast('已保存挂载');
      this.enterMount(mount);
    },

    // 粘贴含 user:pass@ 的地址时自动拆出用户名密码。
    splitManualUrl() {
      const raw = (this.addUrl || '').trim();
      if (!raw) return;
      let url;
      try {
        url = new URL(raw);
      } catch (e) {
        return;
      }
      if (!url.username && !url.password) return;
      if (!this.addUser) {
        try {
          this.addUser = decodeURIComponent(url.username);
        } catch (e) {
          this.addUser = url.username;
        }
      }
      if (!this.addPass) {
        try {
          this.addPass = decodeURIComponent(url.password);
        } catch (e) {
          this.addPass = url.password;
        }
      }
      this.addUrl = url.origin + url.pathname.replace(/\/+$/, '');
    },

    buildManualMount() {
      const url = (this.addUrl || '').trim().replace(/\/+$/, '');
      if (!url) {
        this.addError = '请填写服务器地址';
        return null;
      }
      try {
        new URL(url);
      } catch (e) {
        this.addError = '服务器地址格式不正确';
        return null;
      }
      return normalizeMount({
        id: this.editingMountId || undefined,
        name: (this.addName || '').trim(),
        url,
        username: (this.addUser || '').trim(),
        password: this.addPass || '',
        rememberPassword: this.addRemember,
        mode: this.addMode,
      });
    },

    async testAddMount() {
      const mount = this.buildManualMount();
      if (!mount) return;
      this.addBusy = true;
      this.addError = '';
      this.addTestResult = '';
      const result = await testMountConnection(mount, mount.password);
      this.addBusy = false;
      if (result.ok) {
        this.addTestResult = '连接成功 · 根目录 ' + result.count + ' 项';
      } else {
        this.addError = connectionErrorText(result.error);
      }
    },

    saveManualMount() {
      const mount = this.buildManualMount();
      if (!mount) return;
      const isEdit = !!this.editingMountId;
      if (isEdit) {
        const idx = this.davMounts.findIndex((m) => m.id === this.editingMountId);
        if (idx >= 0) {
          const prev = this.davMounts[idx];
          this.davMounts.splice(idx, 1, {
            ...prev,
            ...mount,
            createdAt: prev.createdAt,
            lastCheckedAt: prev.lastCheckedAt,
            lastStatus: prev.lastStatus,
          });
        }
        // 密码可能改了：会话内密码作废；正在该挂载内则先退出。
        delete this.mountSessionPasswords[mount.id];
        if (this.activeMountId === mount.id) this.exitMount();
      } else {
        this.davMounts.push(mount);
      }
      saveMounts(this.davMounts);
      this.showAddMount = false;
      this.editingMountId = '';
      this.showToast('已保存挂载');
      if (!isEdit) this.enterMount(mount);
    },

    async testMount(mount) {
      const password = this.mountPasswordFor(mount);
      if (!mount.rememberPassword && !password) {
        this.openMountPassword(mount);
        return;
      }
      this.mountTestResults = {
        ...this.mountTestResults,
        [mount.id]: '测试中…',
      };
      const result = await testMountConnection(mount, password);
      const text = result.ok
        ? '连接成功 · 根目录 ' + result.count + ' 项'
        : connectionErrorText(result.error);
      this.mountTestResults = {
        ...this.mountTestResults,
        [mount.id]: text,
      };
      const idx = this.davMounts.findIndex((m) => m.id === mount.id);
      if (idx >= 0) {
        this.davMounts[idx].lastStatus = result.ok ? 'ok' : 'fail';
        this.davMounts[idx].lastCheckedAt = Date.now();
        saveMounts(this.davMounts);
      }
    },

    deleteMount(mount) {
      this.davMounts = this.davMounts.filter((m) => m.id !== mount.id);
      saveMounts(this.davMounts);
      this.mountDeleteArmed = '';
      delete this.mountSessionPasswords[mount.id];
      if (this.activeMountId === mount.id) {
        this.activeMountId = '';
        this.mountStatus = '';
        this.mountLoadError = '';
        clearActiveRef();
        this.fetchFiles();
      }
      this.showToast('已删除挂载');
    },

    // 只复制挂载内路径，不含凭据与代理地址（设计 §6）；不走短链。
    async copyMountPath(item) {
      this.showContextMenu = false;
      const mount = this.activeMount;
      if (!mount) return;
      const rel = typeof item === 'string' ? item : (item && item.key) || '';
      const text = mount.name + ':/' + rel;
      const ok = await copyTextToClipboard(text);
      if (ok) this.showToast('挂载内路径已复制');
      else this.openManualCopy('挂载内路径（请手动复制）：', text);
    },

    // 挂载内文件下载：经代理取回后触发浏览器下载（blob 方式；
    // 大文件会先完整进内存，v1 已知取舍，见 REPORT）。
    async downloadMountFile(item) {
      const mount = this.activeMount;
      if (!mount) return;
      const password = this.mountPasswordFor(mount);
      try {
        const { res } = await davFetch(mount, item.key, {
          method: 'GET',
          password,
        });
        if (res.status === 401 || res.status === 403) {
          this.showToast('用户名或密码错误');
          return;
        }
        if (!res.ok) {
          this.showToast('下载失败，请稍后重试');
          return;
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = item.key.split('/').pop();
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
      } catch (e) {
        this.showToast('下载失败，请稍后重试');
      }
    },

    // Drive 内文件下载：经 /api/drive-proxy（?t=accessToken），
    // 原生文档按导出格式（PDF/PNG）下载；表单等无导出格式的
    // 无法直接下载，提示去 Google 打开。
    async downloadDriveFile(item) {
      const mount = this.activeDriveMount;
      if (!mount) return;
      const ct = this.fileContentType(item);
      const isNative = ct.startsWith('application/vnd.google-apps.');
      if (isNative && !driveExportMime(ct)) {
        this.showToast('该文件无法直接下载，请在 Google Drive 中打开');
        return;
      }
      try {
        if (!this.driveAccessToken) {
          this.driveAccessToken = await getAccessToken(mount);
        }
        const url = this.driveMediaUrlFor(item);
        const res = await fetch(url);
        if (res.status === 401 || res.status === 403) {
          this.showToast('授权已失效，请重新授权');
          return;
        }
        if (!res.ok) {
          this.showToast('下载失败，请稍后重试');
          return;
        }
        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = this.fileDisplayName(item);
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
      } catch (e) {
        this.showToast('下载失败，请稍后重试');
      }
    },

    openShareQr(mount) {
      this.shareQrMount = mount;
      this.shareQrKind = 'json';
      this.shareQrText = '';
      this.showShareQr = true;
      this.showMountManager = false;
      this.$nextTick(() => this.renderShareQr());
    },

    setShareQrKind(kind) {
      this.shareQrKind = kind;
      this.renderShareQr();
    },

    shareQrPayload() {
      const m = this.shareQrMount;
      if (!m) return '';
      return this.shareQrKind === 'json'
        ? flarepanQrPayload(m)
        : plainUrlQrPayload(m);
    },

    async renderShareQr() {
      const box = this.$refs.shareQrBox;
      if (!box || !this.shareQrMount) return;
      const text = this.shareQrPayload();
      this.shareQrText = text;
      this.shareQrError = '';
      box.innerHTML = '';
      try {
        await this.loadScript(
          'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js'
        );
      } catch (e) {}
      if (!window.QRCode) {
        this.shareQrError = '二维码组件加载失败，请用“复制二维码内容”';
        return;
      }
      try {
        // CorrectLevel L：容量最大，留足余量（M 级下中文名载荷会溢出，
        // 见 flarepanQrPayload 注释；2026-11-14 实测）。
        new window.QRCode(box, {
          text,
          width: 180,
          height: 180,
          correctLevel: window.QRCode.CorrectLevel.L,
        });
      } catch (e) {
        // 生成失败不要静默留白框：明说并引导用复制兜底。
        this.shareQrError = '二维码内容过长，生成失败，请用“复制二维码内容”';
      }
    },

    async copyShareQrText() {
      if (!this.shareQrText) return;
      const ok = await copyTextToClipboard(this.shareQrText);
      if (ok) this.showToast('二维码内容已复制');
      else this.openManualCopy('二维码内容（请手动复制）：', this.shareQrText);
    },

    clearShareQr() {
      if (!this.shareQrMount) return;
      this.shareQrCleared = {
        ...this.shareQrCleared,
        [this.shareQrMount.id]: true,
      };
      this.showShareQr = false;
    },

    reshowShareQr() {
      if (!this.shareQrMount) return;
      const cleared = { ...this.shareQrCleared };
      delete cleared[this.shareQrMount.id];
      this.shareQrCleared = cleared;
      this.$nextTick(() => this.renderShareQr());
    },

    closeShareQr() {
      this.showShareQr = false;
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
    // 文件的内容类型：Drive 文件走 file.contentType（files.list 归一
    // 化时填），本地/DAV 走 httpMetadata.contentType。
    fileContentType(file) {
      if (!file) return '';
      return (
        file.contentType ||
        (file.httpMetadata && file.httpMetadata.contentType) ||
        ''
      );
    },

    // 音频队列的去重键：挂载内文件用 挂载id:key（同名文件跨挂载
    // 不串队），本地用 key。
    audioItemKey(f) {
      if (this.activeDriveMount) return this.activeDriveMountId + ':' + f.key;
      if (this.activeMount) return this.activeMountId + ':' + f.key;
      return f.key;
    },

    // 查看器用的内容 URL：DAV 走代理（带 a 参数），Drive 走 drive-proxy
    // （带 ?t=accessToken），本地走 /raw/。
    fileViewUrl(file) {
      if (this.activeDriveMount) return this.driveMediaUrlFor(file);
      if (this.activeMount) return this.mountFileUrl(file.key);
      return '/raw/' + file.key;
    },

    isVideoFile(file) {
      const ct = this.fileContentType(file);
      if (ct.startsWith('video/')) return true;
      // 注意 .ogg 仍归音频（既有行为），视频用 .ogv 区分。
      // 格式尽量放宽：只要是视频文件一律站内打开，绝不因未识别
      // 而 fallback 到新标签页；浏览器解不了的格式由播放器内报错 + 下载。
      return /\.(mp4|m4v|webm|ogv|mov|mkv|avi|wmv|flv|f4v|rm|rmvb|3gp|3g2|3gpp|asf|ts|mts|m2ts|vob|mpg|mpeg|mpe|divx|m3u8|wmx|wvx|asx|mpv|m2v|mp2v|mk3d|ogm|qt|amv|drc|fli|flc|viv|vivo|nsv|roq|smk|bik|avs|gvi|tod|wm)$/i.test(this.fileDisplayName(file));
    },

    isAudioFile(file) {
      const ct = this.fileContentType(file);
      if (ct.startsWith('audio/')) return true;
      return /\.(mp3|wav|ogg|oga|m4a|flac|aac|opus|weba)$/i.test(this.fileDisplayName(file));
    },

    isPdfFile(file) {
      const ct = this.fileContentType(file);
      if (ct === 'application/pdf') return true;
      return /\.pdf$/i.test(this.fileDisplayName(file));
    },

    isImageFile(file) {
      const ct = this.fileContentType(file);
      if (ct.startsWith('image/')) return true;
      return /\.(png|jpe?g|gif|webp|svg|bmp|avif|ico|tiff?)$/i.test(this.fileDisplayName(file));
    },

    isMarkdownFile(file) {
      return /\.(md|markdown)$/i.test(this.fileDisplayName(file));
    },

    isTextFile(file) {
      // .html 也走文本源查看：绝不 iframe 渲染用户 HTML（站内脚本注入风险）。
      return /\.(txt|md|markdown|json|json5|csv|tsv|log|xml|html|htm|css|js|mjs|cjs|ts|jsx|tsx|py|rb|go|rs|java|c|h|cpp|hpp|cc|cs|php|sh|bash|zsh|yml|yaml|toml|ini|conf|cfg|env|sql|diff|patch|tex|rst|adoc|text|srt|vtt)$/i.test(this.fileDisplayName(file));
    },

    async openFile(file) {
      if (this.activeDriveMount) {
        // Drive：先确保 access_token 新鲜（过期时 getAccessToken
        // 内部已静默刷新一次；这里拿不到 token = 刷新失败 → 重新授权）。
        // 原生 Google 文档没有可直接下载的二进制：按 §5.2.2 导出后打开。
        const mount = this.activeDriveMount;
        try {
          this.driveAccessToken = await getAccessToken(mount);
        } catch (e) {
          this.showToast('授权已失效，请重新授权');
          return;
        }
        const exportMime = driveExportMime(this.fileContentType(file));
        if (exportMime) {
          // 原生文档导出：文档/表格/演示文稿 → PDF，绘图 → PNG，
          // 表单/其它原生类型无导出 → 信息页（可点开原网页）。
          if (exportMime === 'application/pdf') {
            this.openPdf(file);
            return;
          }
          if (exportMime === 'image/png') {
            this.openImage(file);
            return;
          }
          this.openInfo(file);
          return;
        }
        // 非原生文件走常规类型分流（不做 DAV 那种 GET 预检：
        // token 已新鲜，查看器加载失败时自己报错）。
      } else if (this.activeMount) {
        // 挂载内文件：GET + Range 只取 1 字节预检；401 不弹 FlarePan 登录框。
        // 不用 HEAD：Cloudreve 等服务会把文件下载 301 到 GET 签名的对象存储
        // 地址，HEAD 跟过去会被拒 403（签名只认 GET），误判成密码错误。
        // GET + Range 走同一条下载链路，401/403 仍能检出。
        const mount = this.activeMount;
        const password = this.mountPasswordFor(mount);
        try {
          const { res } = await davFetch(mount, file.key, {
            method: 'GET',
            password,
            headers: { Range: 'bytes=0-0' },
          });
          if (res.status === 401 || res.status === 403) {
            if (!mount.rememberPassword) {
              delete this.mountSessionPasswords[mount.id];
              this.openMountPassword(mount);
            } else {
              this.showToast('用户名或密码错误');
            }
            return;
          }
          // 文本编辑的冲突基线：记下预检响应里的 ETag（保存时再比对）。
          const etag = res.headers.get('ETag');
          if (etag) file._etag = etag;
        } catch (e) {
          // 预检失败不拦截：让各查看器自己报错。
        }
      } else {
        const st = await this.precheckRaw(file.key);
        if (st === 401) {
          // 分享授权失效：回输码框（与列表页 401 同款处理），不弹账号登录框。
          if (this.shareMode) {
            this.shareState = 'code';
            this.shareRoot = '';
            sessionStorage.removeItem('share:' + this.shareSlug);
            return;
          }
          this.openLoginModal(() => this.openFile(file));
          return;
        }
      }
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
      this.textName = this.fileDisplayName(file);
      this.textIsMarkdown = this.isMarkdownFile(file);
      this.textSize = file.size || 0;
      this.textUrl = this.fileViewUrl(file);
      // 文本编辑基线（只在挂载内记）：ETag + 大小 + 修改时间，
      // 保存时先 PROPFIND 比对，变了就弹冲突框（默认以服务器为准）。
      if (this.activeMount) {
        this.textEditFile = file;
        this.textEditEtag = file._etag || '';
        this.textEditSize = file.size || 0;
        this.textEditUploaded = file.uploaded || '';
      } else {
        this.textEditFile = null;
        this.textEditEtag = '';
        this.textEditSize = 0;
        this.textEditUploaded = '';
      }
    },

    closeText() {
      this.textUrl = '';
      this.textName = '';
      this.textIsMarkdown = false;
      this.textSize = 0;
      this.textEditFile = null;
      this.textEditEtag = '';
      this.textEditSize = 0;
      this.textEditUploaded = '';
    },

    openImage(file) {
      this.closeVideo();
      this.closeText();
      this.closeInfo();
      const images = this.files.filter((f) => this.isImageFile(f)).map((f) => ({
        key: f.key,
        name: this.fileDisplayName(f),
        url: this.fileViewUrl(f),
      }));
      let idx = images.findIndex((im) => im.key === file.key);
      if (idx < 0) {
        images.unshift({
          key: file.key,
          name: this.fileDisplayName(file),
          url: this.fileViewUrl(file),
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
      // 原生 Google 文档（表单等无导出格式）：站内无法下载，改给
      // webViewLink 跳 Google 打开（InfoPreview 里渲染）。
      const exportMime = this.activeDriveMount
        ? driveExportMime(this.fileContentType(file))
        : '';
      const isNative = this.fileContentType(file).startsWith('application/vnd.google-apps.');
      this.infoFile = {
        key: file.key,
        name: this.fileDisplayName(file),
        sizeText: this.fileSizeText(file),
        type: this.fileContentType(file),
        url: this.fileViewUrl(file),
        webViewLink: (file.customMetadata && file.customMetadata.webViewLink) || '',
        noDownload: !!(this.activeDriveMount && isNative && !exportMime),
      };
    },

    closeInfo() {
      this.infoFile = null;
    },

    openVideo(file) {
      this.closeText();
      this.closeImage();
      this.closeInfo();
      this.videoName = this.fileDisplayName(file);
      // 挂载文件禁用转码（videoKey 传空串，见 VideoPlayer onError）；
      // 代理 URL 自带查询串，不再拼 ?play=1。
      this.videoKey = this.activeMount || this.activeDriveMount ? '' : file.key;
      this.videoUrl = this.activeDriveMount
        ? this.driveMediaUrlFor(file)
        : this.activeMount
          ? this.mountFileUrl(file.key)
          : `/raw/${file.key}?play=1`;
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
        key: this.audioItemKey(f),
        name: this.fileDisplayName(f),
        url: this.fileViewUrl(f),
      });
      let list;
      if (playAll) {
        // 当前文件夹（不过滤搜索词）的全部音频，按列表顺序排队。
        list = this.files.filter((f) => this.isAudioFile(f)).map(toItem);
        if (!list.length) list = [toItem(picked)];
      } else {
        list = [toItem(picked)];
      }
      let start = list.findIndex((t) => t.key === this.audioItemKey(picked));
      if (start < 0) start = 0;
      this.playerQueue = list;
      this.playerStartIndex = start;
      // 同一时间只播一种媒体：开音频即关视频小窗。
      this.videoUrl = '';
      this.videoName = '';
      this.videoKey = '';
    },

    openPdf(file) {
      this.pdfName = this.fileDisplayName(file);
      // 预览 URL 带 ?preview=1：换一个缓存键，绕过浏览器里已有的
      // 旧 octet-stream 缓存条目（2026-11-04 续案实测：只改响应头
      // 不够，旧缓存会让重试继续弹下载框；响应头侧同时加了 no-cache
      // 防以后再形成过期缓存）。
      // 窄屏（≤480px，与站内窄屏断点一致）不用 iframe，改走画布渲染：
      // 手机浏览器内嵌查看器在 iframe 里不贴合页宽（站内不行、
      // 新标签页却可以，2026-11-04 案），画布宽度由组件自己按容器算，
      // 在任何手机浏览器上都贴合；桌面继续用浏览器自带查看器。
      this.pdfRenderer = window.innerWidth <= 480 ? 'canvas' : 'iframe';
      // 挂载分支走代理 URL（自带查询串，不再拼 ?preview=1）。
      this.pdfUrl = this.activeDriveMount
        ? this.driveMediaUrlFor(file)
        : this.activeMount
          ? this.mountFileUrl(file.key)
          : `/raw/${file.key}?preview=1`;
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
    // 切位置时换排序偏好（IA）：每位置各自记忆，回来看还是上次的排序。
    activeLocationMount() {
      this.loadPlaceSort();
      this.sortCurrentFiles();
    },

    cwd: {
      handler() {
        if (this.isAdminPage) return;
        this.fetchFiles();
        // 文件夹记忆（IA）：导航即保存，切换位置时不再另存。
        this.savePlaceFolder();
        // 进文件夹后回到顶部（首次挂载除外）；后退/前进同样回顶。
        if (!this.cwdFirstRun) {
          const scroller = this.$refs.mainScroll;
          if (scroller) scroller.scrollTo({ top: 0 });
        }
        this.cwdFirstRun = false;
        // 挂载内不写 ?p=（与分享模式同理）；当前挂载记 sessionStorage，
        // 刷新后恢复；标题显示挂载名或当前目录。
        if (this.activeMount) {
          saveActiveRef(this.activeMountId, this.cwd);
          document.title = `${this.cwd.replace(/.*\/(?!$)|\//g, '') || this.activeMount.name} - FlarePan文件库`;
          return;
        }
        // Drive 挂载内同样不写 ?p=：标题显示当前文件夹或挂载名。
        if (this.activeDriveMount) {
          const cur = this.driveCrumbs.length > 0
            ? this.driveCrumbs[this.driveCrumbs.length - 1].name
            : this.activeDriveMount.name;
          document.title = (cur || 'FlarePan文件库') + ' - FlarePan文件库';
          return;
        }
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
            ? 'FlarePan文件库'
            :`${this.cwd.replace(/.*\/(?!$)|\//g, '') || '/' } - FlarePan文件库`;
      },
      immediate: true,
    },
  },

  created() {
    // 排序记忆（IA）：按初始位置（本地或刷新恢复的挂载）读偏好；
    // immediate 的 cwd watcher 可能已用默认排序渲染了缓存列表，
    // 这里读完偏好再重排一次。切位置时由 activeLocationMount
    // watcher 负责换偏好。
    this.loadPlaceSort();
    this.sortCurrentFiles();
    if (this.shareMode) this.shareLoad();
    // Google Drive 授权回调接应（§4.2）：Google 跳回 ?code=…&state=…
    // 时换 token、建挂载、进挂载；无回调参数时立即返回。
    this.handleDriveCallback();
    // 短链总开关：开关关闭时全部短链入口隐藏（见 siteShortlinkEnabled）。
    this.applySkin(this.skin);
    fetch('/api/site-config')
      .then((res) => res.json())
      .then((data) => {
        if (data && typeof data.shortlink_enabled === 'boolean') {
          this.siteShortlinkEnabled = data.shortlink_enabled;
        }
        if (data && (data.skin === 'starship'
            || data.skin === 'original')) {
          this.skin = data.skin;
          this.applySkin(data.skin);
        } else {
          this.applySkin(this.skin);
        }
      })
      .catch(() => {});
    // 跨页签联动：管理页换肤写 localStorage 后，其他已打开的页收到
    // storage 事件即时跟换，不刷新。
    this._onSkinStorage = (e) => {
      if (e.key === 'pan-skin' && (e.newValue === 'starship'
          || e.newValue === 'original')) {
        this.skin = e.newValue;
        this.applySkin(e.newValue);
      }
    };
    window.addEventListener('storage', this._onSkinStorage);
    // 版本自救：见 checkAppVersion（旧标签页切回可见时自动刷新到新代码）。
    this.checkAppVersion();
    this._onVisibilityChange = () => {
      if (!document.hidden) this.checkAppVersion();
    };
    document.addEventListener('visibilitychange', this._onVisibilityChange);
    window.addEventListener('popstate', (ev) => {
      if (this.shareMode) return;
      // PDF 浮层与历史联动：后退到无 pdf 状态关浮层，前进回到 pdf 状态再打开。
      // 注意：这段必须在挂载 early-return 之前，否则挂载内点 PDF 的 ×
      // 会触发 history.back() 却关不掉浮层（2026-11-14 实测踩坑）。
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
      // 挂载内不用 ?p=，后退/前进不碰挂载路径。
      if (this.activeMount) return;
      const searchParams = new URL(window.location).searchParams;
      if (searchParams.get('p') !== this.cwd)
        this.cwd = normalizeCwd(searchParams.get('p') || '');
    });
  },

  mounted() {
    // 位置标签栏右缘渐隐（IA §2b）：挂 resize；每次渲染后重算
    //（见 updated）；初次挂载后也算一次。
    this._onPlacesResize = () => this.updatePlacesFade();
    window.addEventListener('resize', this._onPlacesResize);
    this.$nextTick(() => this.updatePlacesFade());
    // 挂载提供商（管理后台配置）：提前拉一次，添加挂载对话框里的
    // Google Drive 页签按此显隐；打开对话框时还会再拉一次。
    this.loadMountProviders();
    // 长按提示：点锚点（标签/挂载行/舰体芯片）以外的地方关闭。
    // 提示是 pointer-events:none，点按会穿透到下面元素，所以用
    // document 级 click 兜底；锚点自身的 click 由 switchLocation
    // 的长按标记处理，这里不重复拦。
    this._onDocClickHideTip = (e) => {
      if (!this.mountTip.show) return;
      if (e.target.closest('.chip, .dav-mount-row, .ship, .mount-tip')) return;
      this.hideMountTip();
      this.mountTipLongPress = false;
    };
    document.addEventListener('click', this._onDocClickHideTip);
    // 新建菜单：点菜单以外的地方关闭；Esc 也关闭。
    this._onDocClickHideCreateMenu = (e) => {
      if (!this.showCreateMenu) return;
      if (e.target.closest('.create-wrap')) return;
      this.showCreateMenu = false;
    };
    document.addEventListener('click', this._onDocClickHideCreateMenu);
    this._onEscHideCreateMenu = (e) => {
      if (e.key === 'Escape') this.showCreateMenu = false;
    };
    document.addEventListener('keydown', this._onEscHideCreateMenu);
    // 直接打开受保护文件被带回站内时（?login=1&next=/raw/...）：
    // 弹登录框，登录成功后跳回原文件；取消则去掉参数、不再自动弹。
    // next 只接受站内相对路径（防跳到外站）。
    if (this.shareMode) return;
    const params = new URL(window.location).searchParams;
    if (params.get('login') !== '1') return;
    const next = params.get('next') || '';
    if (next.startsWith('/') && !next.startsWith('//')) {
      this.loginNext = next;
    }
    this.openLoginModal(null);
  },

  updated() {
    // 每次渲染后重算位置标签栏右缘渐隐（挂载增减、切换位置、
    // 皮肤切换都会走到这里；只做 DOM 读与 class 切换，不触发重渲染）。
    this.$nextTick(() => this.updatePlacesFade());
  },

  unmounted() {
    if (this._onPlacesResize) {
      window.removeEventListener('resize', this._onPlacesResize);
    }
    if (this._onDocClickHideTip) {
      document.removeEventListener('click', this._onDocClickHideTip);
    }
    if (this._onDocClickHideCreateMenu) {
      document.removeEventListener('click', this._onDocClickHideCreateMenu);
    }
    if (this._onEscHideCreateMenu) {
      document.removeEventListener('keydown', this._onEscHideCreateMenu);
    }
    if (this._onVisibilityChange) {
      document.removeEventListener('visibilitychange', this._onVisibilityChange);
    }
  },

  components: {
    AdminView: Admin,
    Dialog,
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
  /* 背景图平均色：图未到之前不白，与图衔接自然。 */
  background-color: #b2bdbe;
  /* background-image: url(/assets/bg-light.webp); */
  background-size: cover;
  background-position: center;
  overflow-y: auto;
  /* 到顶下拉不链到文档：否则 iOS Safari 会触发原生下拉刷新整页重载，
     重载时工具栏展开（短视口）定下的布局在工具栏收起后不更新，
     标题栏错位、底部留白，且只有重新访问才能复原。 */
  overscroll-behavior: none;
  flex-direction: column;
  /* 音频条出现/消失时 padding 渐变，内容不跳。 */
  transition: padding-bottom 0.25s ease;
}

/* 应用内下拉刷新指示器：平时高度为 0 不占位；列表到顶下拉时高度
   跟手增长（松开后 0.2s 收回），刷新中固定 48px 转圈。拉动时
   transition 关掉才跟手，收回/刷新态才有过渡。 */
.ptr-indicator {
  flex: none;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: #5a6b6e;
  font-size: 14px;
  transition: height 0.2s ease;
}
.ptr-indicator.ptr-pulling {
  transition: none;
}
/* 指示器文案套白色小 pill：背景图再花也能读；星际深色主题下同样可读。 */
.ptr-text {
  background: rgba(255, 255, 255, 0.8);
  padding: 3px 12px;
  border-radius: 999px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.12);
}
.ptr-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(0, 0, 0, 0.15);
  border-top-color: #00bcd4;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.8);
  animation: ptr-spin 0.8s linear infinite;
}
@keyframes ptr-spin {
  to { transform: rotate(360deg); }
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

/* 自定义状态提示（替代原生 title）：fixed 浮层，标题“显示名 · 状态”
   + 说明行；桌面悬停、手机长按显示。深色卡片两套皮肤通用；
   pointer-events:none，不挡住下面的点击。 */
.mount-tip {
  position: fixed;
  z-index: 10002;
  max-width: 280px;
  background: #24292f;
  color: #fff;
  border-radius: 10px;
  padding: 10px 12px;
  font-size: 13px;
  line-height: 1.6;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
  pointer-events: none;
}
.mount-tip-title {
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 6px;
}
.mount-tip-detail {
  color: #c9d1d9;
  font-size: 12px;
  margin-top: 2px;
  white-space: pre-line;
}

/* 空态插画：内联 SVG，敞开的文件夹 + 漂浮的星点 + 虚线轨道；
   颜色走 currentColor，原始皮肤用青色点缀，星际皮肤用荧光绿
   （见 skin-starship.css）。手机下按视口缩放，不溢出、不变形。 */
.empty-state-art {
  display: block;
  margin: 12px auto 6px;
  width: 132px;
  max-width: 68vw;
  height: auto;
  color: #39909b;
}
.empty-state-text {
  font-size: 16px;
}

/* 管理员登录弹窗：与分享输码区同款半透明面板 + 青色点缀。
   容器本身由 Dialog 提供（浅色白底）；星空主题下的容器与本块
   各元素的深色形态见 assets/skin-starship.css。 */
.login-modal {
  padding: 12px 16px 16px;
  width: 340px;
  max-width: calc(100vw - 48px);
  text-align: center;
}

.login-modal-title {
  font-size: 18px;
  margin-bottom: 6px;
}

.login-modal-sub {
  font-size: 14px;
  color: #555;
  margin-bottom: 18px;
}

.login-field {
  display: block;
  text-align: left;
  font-size: 14px;
  margin-bottom: 12px;
}

.login-field span {
  display: block;
  margin-bottom: 4px;
}

.login-field input {
  display: block;
  width: 100%;
  padding: 10px 12px;
  /* iOS Safari：输入框字号 < 16px 时点按会整页放大，写死 16px 防放大。 */
  font-size: 16px;
  border: 1.5px solid rgba(57, 144, 155, 0.4);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.75);
  outline: none;
}

.login-field input:focus {
  border-color: rgb(57, 144, 155);
  box-shadow: 0 0 0 3px rgba(57, 144, 155, 0.18);
}

.login-field input:disabled {
  opacity: 0.6;
}

.login-modal-error {
  margin: 0 0 12px;
  color: #c00;
  font-size: 14px;
}

.login-modal-primary {
  width: 100%;
  padding: 10px 24px;
  font-size: 15px;
  color: #fff;
  background: rgb(57, 144, 155);
  border: 0;
  border-radius: 50px;
  box-shadow: 2px 4px 6px rgba(0, 0, 0, 0.2);
  cursor: pointer;
}

.login-modal-primary:disabled {
  opacity: 0.6;
  cursor: default;
}

.login-modal-cancel {
  margin-top: 10px;
  padding: 9px 18px;
  font-size: 14px;
  border-radius: 50px;
  border: 1.5px solid rgba(57, 144, 155, 0.4);
  background: rgba(255, 255, 255, 0.75);
  color: rgb(57, 144, 155);
  cursor: pointer;
}

.login-modal-cancel:disabled {
  opacity: 0.6;
  cursor: default;
}

.login-modal-hint {
  margin-top: 14px;
  font-size: 12px;
  color: #888;
}

/* 复制反馈 toast：底部居中，两皮肤通用深底浅字。 */
.pan-toast {
  position: fixed;
  left: 50%;
  bottom: 28px;
  transform: translateX(-50%);
  z-index: 10001;
  padding: 10px 20px;
  font-size: 14px;
  color: #fff;
  background: rgba(20, 24, 28, 0.92);
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 999px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
  white-space: nowrap;
  max-width: calc(100vw - 32px);
  overflow: hidden;
  text-overflow: ellipsis;
  pointer-events: none;
  /* 每次出现都重建节点，动画随之重播一次。 */
  animation: toast-in 0.18s ease-out;
}

@keyframes toast-in {
  from {
    opacity: 0;
    transform: translate(-50%, 8px);
  }
  to {
    opacity: 1;
    transform: translate(-50%, 0);
  }
}

/* 手动复制兜底框里的只读输入框：整段地址可点选/长按复制。 */
.manual-copy-input {
  width: 100%;
  box-sizing: border-box;
  margin-top: 10px;
  padding: 10px 12px;
  font-size: 14px;
  color: #222;
  background: #f6f6f6;
  border: 1px solid #ddd;
  border-radius: 8px;
}

/* ---- WebDAV 挂载（v1 只读）---- */

/* 位置标签栏（IA）：[我的网盘] [挂载…] [+] [管理]。
   标签区横向滚动，管理按钮固定在右、永不滚走；
   后面还有标签时右缘 32px 渐隐（.has-more，见 updatePlacesFade）。 */
.places {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 2px 4px;
}
.places-scroll {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
  overflow-x: auto;
  scrollbar-width: none;
}
.places-scroll::-webkit-scrollbar {
  display: none;
}
.places-scroll.has-more {
  -webkit-mask-image: linear-gradient(to right, #000 calc(100% - 32px), transparent 100%);
  mask-image: linear-gradient(to right, #000 calc(100% - 32px), transparent 100%);
}
.chip {
  flex: 0 0 auto;
  /* 液态玻璃（透明，无主题色）：半透明渐变底 + 磨砂 + 顶边高光 + 柔和外阴影。 */
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.22), rgba(255, 255, 255, 0.07));
  -webkit-backdrop-filter: blur(14px) saturate(1.5);
  backdrop-filter: blur(14px) saturate(1.5);
  border: 1px solid rgba(255, 255, 255, 0.55);
  box-shadow: 0 4px 16px rgba(15, 40, 55, 0.10), inset 0 1px 0 rgba(255, 255, 255, 0.75), inset 0 -1px 0 rgba(15, 40, 55, 0.05);
  color: #24292f;
  border-radius: 999px;
  padding: 7px 14px;
  font-size: 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
  transition: transform 0.15s ease, box-shadow 0.2s ease, background 0.2s ease;
}
.chip:hover {
  transform: translateY(-1px);
}
.chip:active {
  transform: translateY(0) scale(0.98);
}
.chip.on {
  /* 选中态：同一片玻璃更亮、高光更亮、文字加粗；不填任何主题色、不带光晕。 */
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.42), rgba(255, 255, 255, 0.18));
  border-color: rgba(255, 255, 255, 0.8);
  box-shadow: 0 6px 20px rgba(15, 40, 55, 0.14), inset 0 1px 0 rgba(255, 255, 255, 0.95), inset 0 -1px 0 rgba(15, 40, 55, 0.06);
  color: #24292f;
  font-weight: 600;
}
.chip.add {
  border-style: dashed;
  background: transparent;
  -webkit-backdrop-filter: none;
  backdrop-filter: none;
  box-shadow: none;
  color: #656d76;
}
.chip.manage {
  flex: 0 0 auto;
  border: 0;
  background: transparent;
  -webkit-backdrop-filter: none;
  backdrop-filter: none;
  box-shadow: none;
  color: #656d76;
  font-size: 13px;
}

/* 列表头就是排序控件（IA）：名称 / 大小 / 修改时间，点按循环升/降序。 */
.listhead {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 2px;
  border-bottom: 1px solid #eaeef2;
  font-size: 13px;
  color: #656d76;
}
.listhead button {
  border: 0;
  background: transparent;
  font-size: 13px;
  color: #656d76;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  gap: 3px;
  white-space: nowrap;
}
.listhead button:hover {
  background: #eaeef2;
  color: #24292f;
}
.listhead button.on {
  color: #24292f;
  font-weight: 700;
}
.listhead button.on .arr {
  color: rgb(57, 144, 155);
}
.lh-name {
  flex: 1;
  text-align: left;
}
.lh-size, .lh-date {
  flex: 0 0 auto;
  justify-content: flex-end;
}
@media (max-width: 480px) {
  .places {
    padding: 6px 0 4px;
  }
  .chip {
    padding: 6px 10px;
    font-size: 13px;
  }
  .listhead {
    gap: 4px;
  }
  .listhead button {
    padding: 2px 4px;
  }
}

/* 挂载状态点（位置标签与管理抽屉共用）。 */
.loc-dot {
  flex: none;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #8b949e;
}
.loc-dot-ok {
  background: #3fb950;
  box-shadow: 0 0 6px #3fb950;
  /* 在线绿点自身闪烁（透明度明暗，无扩散环；IA 决定）。 */
  animation: dot-blink 1.6s ease-in-out infinite;
}
/* 断连 = 灰色实点、不闪烁（IA 决定；原红色已按此条改灰）。 */
.loc-dot-bad {
  background: #8b949e;
  box-shadow: none;
}

/* 绿点自身闪烁：只有小点本身的透明度明暗，没有扩散环。 */
@keyframes dot-blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.35; }
}
/* 星际皮肤舰体状态点：在线同样绿点自身闪烁，断连灰点静止。 */
html[data-skin="starship"] .ship .dot:not(.dot-bad) {
  animation: dot-blink 1.6s ease-in-out infinite;
}

/* 状态芯片失败灰点（星际皮肤 .dot 本身是绿色；断连按 IA 决定改灰）。 */
.dot-bad {
  background: #8b949e !important;
  box-shadow: none !important;
  animation: none !important;
}

/* 文件行来源角标。 */
.dav-badge {
  display: inline-block;
  margin-left: 6px;
  padding: 1px 7px;
  font-size: 11px;
  line-height: 16px;
  color: #0969da;
  background: rgba(9, 105, 218, 0.1);
  border: 1px solid rgba(9, 105, 218, 0.3);
  border-radius: 999px;
  vertical-align: middle;
  white-space: nowrap;
}

/* 挂载内新建入口（二阶段）：列表头右端液态玻璃「＋ 新建」钮，
   点开是玻璃下拉菜单（上传文件 / 新建文件夹）。只在挂载内渲染；
   桌面与手机同一套交互（手机上只剩 ＋ 圆钮）。 */
.create-wrap {
  position: relative;
  flex: 0 0 auto;
  margin-left: auto;
}
.create-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  white-space: nowrap;
  border-radius: 999px;
  padding: 6px 13px;
  font-size: 13px;
  font-weight: 600;
  color: #24292f;
  border: 1px solid rgba(255, 255, 255, 0.55);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.22), rgba(255, 255, 255, 0.07));
  -webkit-backdrop-filter: blur(14px) saturate(1.5);
  backdrop-filter: blur(14px) saturate(1.5);
  box-shadow: 0 4px 16px rgba(15, 40, 55, 0.10), inset 0 1px 0 rgba(255, 255, 255, 0.75), inset 0 -1px 0 rgba(15, 40, 55, 0.05);
  transition: transform 0.15s ease, box-shadow 0.2s ease, background 0.2s ease;
}
.create-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(15, 40, 55, 0.14), inset 0 1px 0 rgba(255, 255, 255, 0.95), inset 0 -1px 0 rgba(15, 40, 55, 0.06);
}
.create-btn:active {
  transform: translateY(0) scale(0.98);
}
.create-btn .plus {
  display: inline-flex;
  transition: transform 0.25s ease;
  color: rgb(57, 144, 155);
}
.create-btn.open .plus {
  transform: rotate(45deg);
}
.create-btn.open {
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.42), rgba(255, 255, 255, 0.18));
  border-color: rgba(255, 255, 255, 0.8);
}
.create-menu {
  position: absolute;
  right: 0;
  top: calc(100% + 8px);
  min-width: 208px;
  z-index: 50;
  border-radius: 14px;
  padding: 6px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.55);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.92), rgba(255, 255, 255, 0.78));
  -webkit-backdrop-filter: blur(18px) saturate(1.5);
  backdrop-filter: blur(18px) saturate(1.5);
  box-shadow: 0 12px 32px rgba(15, 40, 55, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.9);
  opacity: 0;
  transform: translateY(-4px) scale(0.98);
  pointer-events: none;
  transition: opacity 0.18s ease, transform 0.18s ease;
}
.create-menu.open {
  opacity: 1;
  transform: none;
  pointer-events: auto;
}
.create-menu button {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  text-align: left;
  border: 0;
  background: transparent;
  cursor: pointer;
  padding: 9px 10px;
  border-radius: 9px;
  font-size: 14px;
  color: #24292f;
}
.create-menu button:hover {
  background: rgba(57, 144, 155, 0.10);
}
.create-menu button svg {
  flex: 0 0 auto;
  color: rgb(57, 144, 155);
  align-self: flex-start;
  margin-top: 2px;
}
.create-menu .mi-text {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}
.create-menu .mi-label {
  font-size: 14px;
  color: #24292f;
}
.create-menu .hint {
  display: block;
  font-size: 11px;
  color: #8b949e;
  margin-top: 1px;
}
/* 拖拽悬停遮罩：松手上传到当前文件夹。 */
.mount-drop-mask {
  margin: 10px 16px;
  padding: 22px 12px;
  text-align: center;
  font-size: 15px;
  color: rgb(57, 144, 155);
  background: rgba(57, 144, 155, 0.08);
  border: 2px dashed rgba(57, 144, 155, 0.5);
  border-radius: 12px;
}
/* 上传队列面板：固定底部，音频播放条上方。 */
.mount-upload-panel {
  position: fixed;
  left: 50%;
  transform: translateX(-50%);
  width: min(860px, 94vw);
  z-index: 95;
  background: #fff;
  border: 1px solid rgba(57, 144, 155, 0.3);
  border-bottom: 0;
  border-radius: 12px 12px 0 0;
  box-shadow: 0 -8px 24px rgba(0, 0, 0, 0.12);
  color: #24292f;
  font-size: 13px;
}
.mount-upload-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 12px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
  font-weight: 600;
}
.mount-upload-hide {
  border: 0;
  background: transparent;
  color: #656d76;
  cursor: pointer;
  font-size: 13px;
  white-space: nowrap;
}
.mount-upload-list {
  list-style: none;
  margin: 0;
  padding: 4px 12px 8px;
  max-height: 180px;
  overflow-y: auto;
}
.mount-upload-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 0;
}
.mount-upload-name {
  flex: 0 1 180px;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.mount-upload-bar {
  flex: 1;
  height: 6px;
  background: rgba(0, 0, 0, 0.08);
  border-radius: 999px;
  overflow: hidden;
}
.mount-upload-bar span {
  display: block;
  height: 100%;
  background: rgb(57, 144, 155);
  border-radius: 999px;
}
.mount-upload-state {
  flex: 0 0 auto;
  color: #57606a;
  max-width: 220px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.mount-upload-retry,
.mount-upload-cancel {
  flex: 0 0 auto;
  border: 1px solid #d0d7de;
  background: #fff;
  border-radius: 8px;
  padding: 4px 10px;
  font-size: 12px;
  cursor: pointer;
  color: #24292f;
}
/* 写操作 Dialog：与挂载抽屉同宽。 */
.dav-write-dialog {
  width: 460px;
  max-width: calc(100vw - 48px);
  padding: 12px 16px 16px;
}
.dav-delete-text {
  font-size: 14px;
  line-height: 1.7;
  color: #24292f;
  margin-bottom: 12px;
}
.dav-danger-text {
  color: #cf222e !important;
}
.dav-danger-btn {
  background: #cf222e !important;
  border-color: #cf222e !important;
}
@media (max-width: 400px) {
  /* 手机上新建钮只剩 ＋ 圆钮，文字收起。 */
  .create-btn .lbl {
    display: none;
  }
  .create-btn {
    padding: 6px 9px;
  }
  .mount-upload-name {
    flex-basis: 110px;
  }
  .mount-upload-state {
    max-width: 120px;
  }
}

/* 挂载抽屉通用。 */
.dav-manager,
.dav-add,
.dav-share {
  width: 460px;
  max-width: calc(100vw - 48px);
  padding: 12px 16px 16px;
}
.dav-modal-title {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 12px;
}
.dav-privacy {
  margin-top: 14px;
  font-size: 12px;
  line-height: 1.6;
  color: #888;
}
.dav-empty {
  text-align: center;
  padding: 18px 0 6px;
}
.dav-empty-sub {
  font-size: 13px;
  color: #888;
  margin: 8px 0 16px;
}
.dav-mount-list {
  list-style: none;
  margin: 0 0 12px;
  padding: 0;
}
.dav-mount-row {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  padding: 12px 4px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
  flex-wrap: wrap;
}
.dav-mount-row .loc-dot {
  margin-top: 6px;
}
.dav-mount-info {
  flex: 1 1 200px;
  min-width: 0;
}
.dav-mount-name {
  font-size: 15px;
  font-weight: 600;
}
.dav-mount-url {
  font-size: 12px;
  color: #666;
  word-break: break-all;
}
.dav-mount-status {
  font-size: 12px;
  color: #888;
  margin-top: 2px;
}
.dav-mount-test {
  font-size: 12px;
  color: #0969da;
  margin-top: 2px;
}
.dav-mount-actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.dav-mount-actions button {
  padding: 5px 10px;
  font-size: 13px;
  border-radius: 999px;
  border: 1.5px solid rgba(57, 144, 155, 0.4);
  background: rgba(255, 255, 255, 0.75);
  color: rgb(57, 144, 155);
  cursor: pointer;
}
.dav-mount-actions button.dav-danger {
  color: #c00;
  border-color: rgba(204, 0, 0, 0.4);
}

/* 添加挂载：扫码 / 手动分段。 */
.dav-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 14px;
}
.dav-tabs button {
  flex: 1;
  padding: 9px 0;
  font-size: 14px;
  border-radius: 10px;
  border: 1.5px solid rgba(57, 144, 155, 0.4);
  background: rgba(255, 255, 255, 0.75);
  color: rgb(57, 144, 155);
  cursor: pointer;
}
.dav-tabs button.on {
  background: rgb(57, 144, 155);
  color: #fff;
  border-color: rgb(57, 144, 155);
}
.dav-scan-hint {
  font-size: 13px;
  color: #555;
  margin-bottom: 12px;
  line-height: 1.6;
}
/* 猫头鹰二维码警告：码里密码是加密串、登不上，引导去手动添加。 */
.dav-owl-warn-text {
  margin: 8px 0 12px;
  font-size: 13px;
  line-height: 1.7;
  color: #b3541e;
}
.dav-scan-btns {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}
.dav-scan-box {
  margin-bottom: 12px;
}
.dav-scan-box #dav-scan-reader {
  width: 100%;
  border-radius: 12px;
  overflow: hidden;
}
.dav-scan-box #dav-scan-reader video {
  width: 100% !important;
}
.dav-paste {
  display: block;
  width: 100%;
  min-height: 64px;
  padding: 10px 12px;
  font-size: 14px;
  border: 1.5px solid rgba(57, 144, 155, 0.4);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.75);
  outline: none;
  resize: vertical;
}
.dav-parsed {
  margin-top: 14px;
  padding: 12px;
  border: 1px solid rgba(57, 144, 155, 0.4);
  border-radius: 12px;
  background: rgba(57, 144, 155, 0.06);
}
.dav-parsed-ok {
  font-size: 15px;
  font-weight: 600;
  color: #0a7a6e;
  margin-bottom: 10px;
}
.dav-parsed-src {
  font-size: 12px;
  font-weight: 400;
  color: #888;
}
.dav-parsed-row {
  display: flex;
  gap: 8px;
  font-size: 14px;
  margin-bottom: 8px;
}
.dav-parsed-row span {
  flex: none;
  color: #666;
  width: 52px;
}
.dav-parsed-row b {
  font-weight: 500;
  word-break: break-all;
}
.dav-check {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  margin-bottom: 10px;
  cursor: pointer;
}
.dav-mode {
  font-size: 14px;
  margin-bottom: 12px;
  line-height: 2;
}
.dav-mode label {
  margin-right: 12px;
  cursor: pointer;
  white-space: nowrap;
}
.dav-form-btns {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  margin-top: 4px;
  flex-wrap: wrap;
}
.dav-test-ok {
  margin: 0 0 12px;
  color: #0a7a6e;
  font-size: 14px;
}
/* .login-field span 的 display:block 会盖掉 flex，这里用更高特异性写回。 */
.login-field span.dav-pass-wrap {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 0;
}
.login-field .dav-pass-wrap input {
  flex: 1 1 0;
  min-width: 0;
}
.dav-eye {
  flex: none;
  padding: 6px 10px;
  font-size: 13px;
  border-radius: 999px;
  border: 1.5px solid rgba(57, 144, 155, 0.4);
  background: rgba(255, 255, 255, 0.75);
  color: rgb(57, 144, 155);
  cursor: pointer;
}

/* 分享二维码。 */
.dav-share-name {
  font-size: 13px;
  color: #666;
  margin-bottom: 10px;
  word-break: break-all;
}
.dav-qr-box {
  display: flex;
  justify-content: center;
  padding: 16px;
  background: #fff;
  border-radius: 12px;
  margin: 12px 0;
}
.dav-qr-box img,
.dav-qr-box canvas {
  display: block;
}
.dav-share-warn {
  font-size: 13px;
  color: #b45309;
  line-height: 1.6;
  margin-bottom: 12px;
}
.dav-share-err {
  font-size: 13px;
  color: #dc2626;
  line-height: 1.6;
  margin-bottom: 12px;
}
.dav-share-cleared {
  font-size: 14px;
  line-height: 1.6;
  padding: 12px 0;
}
</style>
