<template>
  <div class="admin-page">
    <!-- 登录页：整页表单，杜绝遮罩冒泡误关 -->
    <div v-if="view === 'login'" class="admin-login">
      <h1>FlarePan 管理后台</h1>
      <p class="admin-sub">请登录后管理文件、受保护文件夹、分享、WebDAV、短链、账号与权限。</p>
      <div class="admin-form">
        <label>账号
          <input v-model="loginUser" placeholder="账号" autocomplete="username" />
        </label>
        <label>密码
          <input
            v-model="loginPass"
            type="password"
            placeholder="密码"
            autocomplete="current-password"
            @keyup.enter="doLogin" />
        </label>
        <div v-if="loginError" class="admin-error">{{ loginError }}</div>
        <button
          @click="doLogin"
          :disabled="loginBusy"
          class="admin-btn-primary">
          {{ loginBusy ? "登录中..." : "登录" }}
        </button>
      </div>
    </div>

    <!-- 控制台 -->
    <div v-else class="admin-console">
      <div class="admin-bar">
        <h1>FlarePan 管理后台</h1>
        <span v-if="user" class="admin-who">当前账号：{{ user }}</span>
        <button @click="doLogout" class="admin-btn">退出</button>
      </div>
      <div class="admin-layout">
        <nav class="admin-sidebar">
          <button class="admin-nav-item" :class="{ on: tab === 'overview' }" @click="switchTab('overview')">
            <span class="admin-nav-label">概览</span>
          </button>
          <div v-for="group in navGroups" :key="group.id" class="admin-nav-group">
            <div class="admin-nav-group-title">{{ group.label }}</div>
            <button v-for="item in group.items" :key="item.id" class="admin-nav-item" :class="{ on: tab === item.id }" @click="switchTab(item.id)">
              <span class="admin-nav-label">{{ item.label }}</span>
              <span v-if="item.badge !== null && item.badge !== undefined" class="admin-nav-badge">{{ item.badge }}</span>
            </button>
          </div>
          <div class="admin-nav-status">
            <span class="admin-status-dot" :class="{ ok: overviewOk, bad: !!overviewError }"></span>
            <span>{{ overviewStatusText }}</span>
          </div>
        </nav>
        <main class="admin-main">
          <div v-if="globalError" class="admin-error">{{ globalError }}</div>

          <!-- 概览页 -->
          <section v-if="tab === 'overview'">
            <h2>概览</h2>
            <div v-if="overviewLoading">正在加载…</div>
            <div v-else-if="overviewError" class="admin-error">{{ overviewError }} <button @click="loadOverview">重试</button></div>
            <div v-else-if="overview">
              <div class="admin-ov-grid">
                <div class="admin-ov-card">
                  <div class="admin-ov-num">{{ formatSize(overview.storage.totalBytes) }}</div>
                  <div class="admin-ov-label">存储用量</div>
                  <div v-if="overview.storage.totalMb" class="admin-ov-bar"><div class="admin-ov-bar-fill" :style="{ width: storagePct + '%' }"></div></div>
                  <div v-else class="admin-ov-bar"><div class="admin-ov-bar-fill is-unlimited" title="不限量"></div></div>
                  <div v-if="overview.storage.totalMb" class="admin-ov-sub">共 {{ formatSize(overview.storage.totalMb * 1024 * 1024) }} · 已用 {{ storagePct }}%</div>
                  <div v-else class="admin-ov-sub">{{ overview.storage.fileCount }} 个对象 · 不限量</div>
                </div>
                <div class="admin-ov-card">
                  <div class="admin-ov-num">{{ overview.shares.count }}</div>
                  <div class="admin-ov-label">分享中</div>
                  <div class="admin-ov-sub">{{ overview.shares.count ? '最近：' + (overview.shares.recent[0] ? overview.shares.recent[0].prefix : '') : '还没有分享' }}</div>
                </div>
                <div class="admin-ov-card">
                  <div class="admin-ov-num">{{ overview.mounts.enabled.length }}</div>
                  <div class="admin-ov-label">挂载</div>
                  <div class="admin-ov-sub">{{ overview.mounts.enabled.length ? overview.mounts.enabled.map((p) => p.name).join('、') + ' 已配置' : '未配置第三方挂载' }}</div>
                </div>
                <div class="admin-ov-card">
                  <div class="admin-ov-num">{{ overview.accounts.count }}</div>
                  <div class="admin-ov-label">账号</div>
                  <div class="admin-ov-sub">{{ overview.accounts.adminCount }} 个管理员</div>
                </div>
              </div>
              <p class="admin-ov-sentence">{{ overviewSentence }}</p>
              <h3 class="admin-ov-h3">最近动态</h3>
              <ul class="admin-ov-activity">
                <li v-for="a in overview.shares.recent" :key="a.slug">
                  <span class="admin-ov-act-kind">分享</span>
                  <span class="admin-ov-act-main">{{ a.prefix || '/' }}<span v-if="a.slug"> · {{ a.slug }}</span></span>
                  <span class="admin-ov-act-time">{{ formatTime(a.createdAt) }}</span>
                </li>
                <li v-if="!overview.shares.recent || !overview.shares.recent.length" class="admin-ov-act-empty">暂无动态</li>
              </ul>
              <div class="admin-ov-actions">
                <button class="admin-btn-primary" @click="switchTab('files')">上传文件</button>
                <button class="admin-btn" @click="switchTab('shares')">新建分享</button>
                <button class="admin-btn" @click="switchTab('mounts')">添加挂载</button>
              </div>
            </div>
          </section>

          <!-- 文件页 -->
          <section v-if="tab === 'files'">
        <h2>文件</h2>
        <div class="admin-row">
          <span>当前目录：{{ cwd || "/" }}</span>
        </div>
        <div v-if="filesError" class="admin-error">{{ filesError }}</div>
        <!-- 加载态只在列表为空时占位；有旧列表时保留旧列表、顶部一条
             细加载条，切文件夹不再整列表闪白。 -->
        <div v-if="filesLoading && !files.length && !folders.length">加载中...</div>
        <div v-if="filesLoading && (files.length || folders.length)" class="list-loading-bar"></div>
        <ul v-if="files.length || folders.length || !filesLoading" class="admin-list">
          <li
            v-if="cwd !== ''"
            class="admin-file-row admin-up-row"
            @click="goUp">
            <div class="admin-file-icon"><FolderIcon /></div>
            <div class="admin-file-info">
              <span class="admin-file-name">返回上级目录</span>
            </div>
          </li>
          <li v-for="f in folders" :key="f" class="admin-file-row">
            <div class="admin-file-icon"><FolderIcon /></div>
            <div class="admin-file-info">
              <span class="admin-file-name admin-folder-name" @click="cwd = f; fetchFilesAdmin()">{{ folderDisplayName(f) }}</span>
              <span class="admin-file-meta">文件夹</span>
            </div>
            <div class="admin-file-actions">
              <button v-if="shortenEnabled" @click="copyShortLink('/?p=' + encodeURIComponent(f))">复制短链</button>
              <button @click="renameFolder(f)">改名</button>
              <button
                @click="deleteFolder(f)"
                class="admin-danger">删除</button>
            </div>
          </li>
          <li v-for="file in files" :key="file.key" class="admin-file-row">
            <div class="admin-file-icon">
              <MimeIcon :content-type="file.httpMetadata ? file.httpMetadata.contentType : ''"
                :thumbnail="file.customMetadata && file.customMetadata.thumbnail
                  ? `/raw/_$flaredrive$/thumbnails/${file.customMetadata.thumbnail}.png`
                  : null" />
            </div>
            <div class="admin-file-info">
              <span
                class="admin-file-name">{{ file.key.split("/").pop() }}</span>
              <span class="admin-file-meta">{{ formatDate(file.uploaded) }} · {{ formatSize(file.size) }}</span>
            </div>
            <div class="admin-file-actions">
              <a :href="'/raw/' + file.key.split('/').map(encodeURIComponent).join('/')" target="_blank">预览/下载</a>
              <button v-if="shortenEnabled" @click="copyShortLink('/raw/' + file.key.split('/').map(encodeURIComponent).join('/'))">复制短链</button>
              <button @click="renameItem(file.key)">改名</button>
              <button @click="moveItem(file.key)">移动</button>
              <button
                @click="deleteItem(file.key)"
                class="admin-danger">删除</button>
            </div>
          </li>
        </ul>
        <div v-if="!filesLoading && !files.length && !folders.length && !filesError" class="admin-empty">没有文件</div>
        <div class="admin-box">
          <h3>上传到当前目录</h3>
          <input
            type="file"
            ref="uploadInput"
            multiple
            @change="onPickFiles"
            :disabled="uploading"
            style="display: none" />
          <div class="admin-row">
            <button @click="pickFiles" :disabled="uploading">选择文件</button>
            <button
              @click="startUploadBatch"
              :disabled="uploading || !uploadQueue.length"
              class="admin-btn-primary">{{ uploading ? '上传中…' : '开始上传' }}</button>
          </div>
          <div v-if="uploading" class="admin-busy">正在上传 {{ uploadBatchIndex }}/{{ uploadBatchCount }} · {{ totalPercent }}% · {{ formatSize(uploadBatchLoaded) }}/{{ formatSize(uploadBatchTotal) }}</div>
          <div v-if="uploadQueue.length" class="admin-upload-queue">
            <div v-for="row in uploadQueue" :key="row.id" class="admin-upload-row">
              <div class="admin-upload-row-top">
                <span class="admin-upload-name" :title="row.name">{{ row.name }}</span>
                <span :class="'admin-upload-pill admin-upload-pill-' + row.status">{{ uploadStatusText(row) }}</span>
              </div>
              <div class="admin-progress">
                <div class="admin-progress-fill" :style="{ width: row.percent + '%' }"></div>
              </div>
              <div class="admin-upload-row-bottom">
                <span class="admin-upload-meta">{{ formatSize(row.loaded) }} / {{ formatSize(row.size) }} · {{ row.percent }}%</span>
                <span v-if="row.error" class="admin-upload-error">{{ row.error }}</span>
                <span v-if="row.note" class="admin-upload-note">{{ row.note }}</span>
                <span class="admin-upload-actions">
                  <button
                    v-if="row.status === 'failed' || row.status === 'cleaned'"
                    @click="retryRow(row)"
                    :disabled="uploading">重试</button>
                  <button
                    v-if="row.status === 'failed' || row.status === 'cleaned'"
                    @click="cleanAndRetryRow(row)"
                    :disabled="uploading">清理并重试</button>
                  <button
                    v-if="row.status === 'queued' || row.status === 'failed' || row.status === 'cleaned'"
                    @click="removeRow(row)"
                    :disabled="uploading">移除</button>
                </span>
              </div>
            </div>
          </div>
          <div v-if="uploadQueue.length" class="admin-upload-batchbar">
            <button @click="retryAllFailed" :disabled="uploading || !hasFailedRows">重试全部失败</button>
            <button @click="clearDoneRows" :disabled="uploading || !hasDoneRows">清空已完成</button>
            <div v-if="uploadBatchCount" class="admin-upload-totalbar">
              <span class="admin-upload-total">总进度 {{ formatSize(uploadBatchLoaded) }} / {{ formatSize(uploadBatchTotal) }} · {{ totalPercent }}%</span>
              <div class="admin-progress">
                <div class="admin-progress-fill" :style="{ width: totalPercent + '%' }"></div>
              </div>
            </div>
          </div>
          <div v-if="uploadSummary" class="admin-ok">{{ uploadSummary }}</div>
          <div v-if="uploadError" class="admin-error">{{ uploadError }}</div>
        </div>
        <div class="admin-box">
          <h3>新建文件夹</h3>
          <input v-model="newFolderName" placeholder="文件夹名称" />
          <button @click="mkdirItem">新建</button>
        </div>
        <div v-if="actionError" class="admin-error">{{ actionError }}</div>
        <div v-if="actionOk" class="admin-ok">{{ actionOk }}</div>
      </section>

      <!-- 受保护文件夹页：勾选即自动保存，无两步歧义；增加保护走文件夹选择器，不手输前缀 -->
      <section v-if="tab === 'protection'">
        <h2>受保护文件夹</h2>
        <p class="admin-desc">未登录访客看不到这些文件夹，也打不开里面的文件。勾选或取消勾选会立即保存，立即生效。点 ▸ 可展开子文件夹，任意深度都能勾选；勾选父级后其下内容在读取时一并被挡，子级不会被自动勾选。</p>
        <div v-if="protCorrupted" class="admin-warn">配置损坏：下方列表以服务端为准。如列表无误，点“用当前列表覆盖修复”即可覆盖损坏的配置；平时勾选或取消勾选一项也会自动覆盖。</div>
        <div v-if="protCorrupted" class="admin-row">
          <button
            @click="repairProtection"
            :disabled="protBusy"
            class="admin-btn-primary">用当前列表覆盖修复</button>
        </div>
        <div v-if="protError" class="admin-error">{{ protError }}</div>
        <div v-if="protOk" class="admin-ok">{{ protOk }}</div>
        <div v-if="protBusy" class="admin-busy">保存中…</div>
        <div v-if="protFoldersLoading">正在加载文件夹…</div>
        <div v-else>
          <ul class="admin-list">
            <li v-for="row in protTreeRows" :key="row.key">
              <template v-if="row.kind === 'folder'">
                <div
                  class="admin-tree-row"
                  :style="{ paddingLeft: (row.depth * 16) + 'px' }">
                  <button
                    class="admin-tree-exp"
                    :disabled="!!protTreeLoading[row.prefix]"
                    @click="toggleTreeNode(row)">{{ protTreeExpanded[row.prefix] ? "▾" : "▸" }}</button>
                  <label class="admin-check-row admin-tree-check">
                    <input
                      type="checkbox"
                      :key="'tree:' + row.prefix + ':' + protSeq"
                      :checked="isProtected(row.prefix)"
                      :disabled="protBusy"
                      @change="toggleProtection(row.prefix, $event.target.checked)" />
                    <span class="admin-tree-icon"><FolderIcon /></span>
                    <span class="admin-name">{{ folderDisplayName(row.prefix) }}</span>
                    <span
                      v-if="isProtected(row.prefix)"
                      class="admin-prot-tag">受保护</span>
                    <span
                      v-else-if="isCoveredByAncestor(row.prefix)"
                      class="admin-tree-covered">已由父级覆盖</span>
                    <button
                      v-if="isProtected(row.prefix)"
                      @click="shareFolder(row.prefix)">分享</button>
                  </label>
                </div>
                <div v-if="protTreeLoading[row.prefix]" class="admin-tree-status" :style="{ paddingLeft: (row.depth * 16 + 32) + 'px' }">加载中…</div>
                <div v-if="protTreeFailed.includes(row.prefix)" class="admin-tree-status" :style="{ paddingLeft: (row.depth * 16 + 32) + 'px' }">加载失败，点击 ▸ 重试</div>
              </template>
              <div v-else class="admin-tree-empty" :style="{ paddingLeft: (row.depth * 16 + 32) + 'px' }">空文件夹</div>
            </li>
          </ul>
          <div
            v-if="!protTreeRows.length && !protFoldersError"
            class="admin-empty">暂无文件夹</div>
          <div
            v-if="protFoldersError"
            class="admin-error">{{ protFoldersError }}</div>
          <div v-if="protOther.length">
            <h3 class="admin-subhead">其他已保护前缀</h3>
            <p class="admin-desc">这些前缀不在文件夹树里（文件夹已被删除，或所在分支加载失败），取消勾选即可解除保护。</p>
            <ul class="admin-list">
              <li v-for="p in protOther" :key="p">
                <label class="admin-check-row">
                  <input
                    type="checkbox"
                    :key="'other:' + p + ':' + protSeq"
                    :checked="true"
                    :disabled="protBusy"
                    @change="toggleProtection(p, $event.target.checked)" />
                  <span class="admin-name">🔒 {{ p }}</span>
                </label>
                <button @click="shareFolder(p)">分享</button>
              </li>
            </ul>
          </div>
          <div class="admin-box">
            <h3>增加保护</h3>
            <p class="admin-desc">从文件夹树里选一个文件夹，再点增加。要保护新文件夹时，先在文件页建好文件夹，再回来从树里选。</p>
            <div class="admin-row">
              <span>已选文件夹：{{ protPick || "未选择" }}</span>
              <button @click="openPicker('protection')">选择文件夹</button>
              <button
                @click="addProtection(protPick)"
                :disabled="protBusy || !protPick"
                class="admin-btn-primary">增加保护</button>
            </div>
          </div>
        </div>
      </section>

      <!-- 分享页 -->
      <section v-if="tab === 'shares'">
        <h2>分享</h2>
        <p class="admin-desc">给受保护文件夹生成分享链接与提取码，访客不用登录，输对码就能浏览和下载该文件夹。提取码只在创建或重新生成时显示一次，之后任何地方都拿不回原文，丢了只能重新生成。带码链接与带码短链也只在生成时显示一次；之后如需新的带码形态，请在列表里重新生成提取码（旧码立即失效）。</p>
        <div v-if="shareError" class="admin-error">{{ shareError }}</div>
        <div v-if="shareOk" class="admin-ok">{{ shareOk }}</div>
        <div v-if="shareWarn" class="admin-warn">{{ shareWarn }}</div>
        <div class="admin-box">
          <h3>新建分享</h3>
          <div class="admin-row">
            <span>文件夹：{{ shareForm.prefix || "未选择" }}</span>
            <button @click="openPicker('share')">选择文件夹</button>
            <input
              v-model="shareForm.code"
              placeholder="提取码（留空自动生成，4-8 位字母数字）" />
            <select v-model="shareForm.expiresIn">
              <option value="30d">30 天</option>
              <option value="7d">7 天</option>
              <option value="permanent">永久</option>
            </select>
            <button
              @click="createShare"
              :disabled="shareBusy"
              class="admin-btn-primary">生成分享</button>
          </div>
        </div>
        <div v-if="shareResult" class="admin-box">
          <h3>分享已生成（提取码只显示这一次）</h3>
          <div>链接：<code>{{ shareResultLink }}</code></div>
          <div>提取码：<code>{{ shareResult.code }}</code></div>
          <div class="admin-row">
            <button
              @click="copyShareResult"
              class="admin-btn-primary">复制链接与提取码</button>
            <button @click="copyShareCodeLink">复制带提取码的链接</button>
            <button @click="copyShareCodeShortLink">复制带提取码的短链</button>
            <button v-if="shortenEnabled" @click="copyShareShortLink(shareResult)">复制短链</button>
          </div>
        </div>
        <div v-if="shares.length" class="admin-row share-filter">
          <select v-model="shareFilterPrefix">
            <option value="all">全部文件夹</option>
            <option v-for="p in shareFilterPrefixes" :key="p" :value="p">{{ p }}</option>
          </select>
          <select v-model="shareFilterStatus">
            <option value="all">全部状态</option>
            <option value="active">正常</option>
            <option value="expired">已过期</option>
            <option value="locked">已锁定</option>
            <option value="disabled">已停用</option>
          </select>
          <button @click="purgeExpiredShares">清理已过期</button>
        </div>
        <ul class="admin-list">
          <li v-for="s in filteredShares" :key="s.slug" class="admin-user-row share-row">
            <span><strong>{{ s.prefix }}</strong></span>
            <span><code>{{ shareLinkOf(s) }}</code></span>
            <span>{{ shareExpiryText(s) }}</span>
            <span :class="'share-status-pill share-status-' + shareStatus(s)">{{ shareStatusText(s) }}</span>
            <button @click="toggleShareDetail(s)">{{ shareExpanded[s.slug] ? '收起管理 ▾' : '链接管理 ▸' }}</button>
            <button @click="copyShareLink(s)">复制链接</button>
            <button v-if="shortenEnabled" @click="copyShareShortLink(s)">复制短链</button>
            <button @click="regenerateShare(s)">重新生成提取码</button>
            <button v-if="s.enabled" @click="setShareEnabled(s, false)">停用</button>
            <button v-else @click="setShareEnabled(s, true)">启用</button>
            <button @click="deleteShare(s)" class="admin-danger">撤销</button>
            <div v-if="shareExpanded[s.slug]" class="share-detail">
              <div class="share-detail-section">
                <h4>链接</h4>
                <div>普通链接：<code>{{ shareLinkOf(s) }}</code> <button @click="copyShareLink(s)">复制</button></div>
                <div class="admin-desc">提取码只显示一次，当前无法重新显示；如需带码链接请重新生成（旧码立即失效）。 <button @click="regenerateAndCopyCodeLink(s)">重新生成并复制带码链接</button></div>
              </div>
              <div v-if="shortenEnabled" class="share-detail-section">
                <h4>短链<span v-if="typeof s.shortlinkCount === 'number'">（{{ s.shortlinkCount }} 条）</span></h4>
                <div v-if="shareShortlinksLoading[s.slug]">加载中…</div>
                <div v-else-if="shareShortlinksError[s.slug]" class="admin-error">{{ shareShortlinksError[s.slug] }}</div>
                <ul v-else-if="shareShortlinksRows(s).length" class="admin-list">
                  <li v-for="r in shareShortlinksRows(s)" :key="r.shortCode" class="admin-user-row">
                    <span><code>{{ r.shortLink || r.shortCode }}</code></span>
                    <span class="share-type-pill">{{ shareShortlinkTypeText(r) }}</span>
                    <span>{{ shortlinkTimeText(r) }}</span>
                    <button v-if="r.shortLink" @click="copyShortlinkRow(r)">复制短链</button>
                    <button @click="deleteShortlinkRow(s, r)" class="admin-danger">删除短链</button>
                  </li>
                </ul>
                <div v-else class="admin-desc">尚未生成短链 <button @click="createPlainShortlink(s)">生成普通短链</button></div>
              </div>
              <div v-else class="admin-desc">短链功能已关闭，去“短链”页签开启。</div>
            </div>
          </li>
        </ul>
        <div v-if="!shares.length && !shareError" class="admin-empty">暂无分享<br /><span>先在“受保护文件夹”页勾选文件夹，再回来新建分享。</span></div>
        <div v-else-if="shares.length && !filteredShares.length" class="admin-empty">没有符合条件的分享 <button @click="clearShareFilters">清除筛选</button></div>
      </section>

      <!-- WebDAV 页 -->
      <section v-if="tab === 'dav'">
        <h2>WebDAV</h2>
        <div v-if="davError" class="admin-error">{{ davError }}</div>
        <div v-if="davOk" class="admin-ok">{{ davOk }}</div>
        <div class="admin-row">
          <label class="switch-row">
            <span class="switch-label">启用 WebDAV</span>
            <span class="switch">
              <input type="checkbox" v-model="davEnabled" @change="saveDav" :disabled="davSwitchBusy || davEnabled === null" />
              <span class="switch-track"><span class="switch-thumb"></span></span>
            </span>
            <span class="switch-hint">{{ davSwitchBusy ? '保存中…' : (davEnabled ? '已开启' : '已关闭') }}</span>
          </label>
        </div>
        <div v-if="davEnabled === false" class="admin-desc">WebDAV 功能已关闭：DAV 接口会拒绝全部请求，客户端将无法连接。重新打开上方开关即可恢复。</div>
        <div v-if="davEnabled">
        <div class="admin-box">
          <div>WebDAV 地址：<code>{{ davAddr }}</code>
            <button @click="copyDavAddr">复制</button>
          </div>
          <div v-if="davCopyOk" class="admin-ok">{{ davCopyOk }}</div>
        </div>
        <div class="admin-box">
          <h3>接入指引</h3>
          <p>Finder：前往 → 连接服务器，输入上方 WebDAV 地址，按提示输入账号密码。</p>
          <p>Windows：文件资源管理器 → 映射网络驱动器，文件夹填上方 WebDAV 地址，勾选“使用其他凭据连接”。</p>
          <p>rclone 配置示例（请把占位符换成你自己的账号）：</p>
          <pre>[pan]
type = webdav
url = {{ davAddr }}
vendor = other
user = &lt;你的账号&gt;
pass = &lt;你的密码&gt;</pre>
          <p>每账号的 DAV 开关在“账号”页里单独设置。</p>
        </div>
        </div>
      </section>

      <!-- 短链页 -->
      <section v-if="tab === 'shorten'">
        <h2>短链</h2>
        <p class="admin-desc">复制短链用的短链服务配置。保存后立即生效，不用重部署；Token 只在服务端用，保存后不会再显示。Token 以 Sink 的密钥为准，保存时会自动去掉首尾空白。后台没配齐时沿用部署环境变量。</p>
        <div class="admin-row">
          <label class="switch-row">
            <span class="switch-label">启用短链功能</span>
            <span class="switch">
              <input type="checkbox" v-model="shortenEnabled" @change="saveShortenEnabled" :disabled="shortenSwitchBusy" />
              <span class="switch-track"><span class="switch-thumb"></span></span>
            </span>
            <span class="switch-hint">{{ shortenSwitchBusy ? '保存中…' : (shortenEnabled ? '已开启' : '已关闭') }}</span>
          </label>
        </div>
        <div v-if="!shortenEnabled" class="admin-desc">短链功能已关闭：前台与本后台不再显示任何短链入口，短链接口也会拒绝请求。重新勾选上方开关即可恢复。</div>
        <div v-if="shortenEnabled">
        <div
          v-if="shortenCorrupted"
          class="admin-warn">后台配置损坏：已存的值不合法，已按未配置处理，请重新保存正确的地址和 Token。</div>
        <div v-if="shortenError" class="admin-error">{{ shortenError }}</div>
        <div v-if="shortenOk" class="admin-ok">{{ shortenOk }}</div>
        <div class="admin-row">
          <span>当前生效来源：{{ shortenSourceText }}</span>
        </div>
        <div class="admin-row">
          <span>服务地址</span>
          <input
            v-model="shortenBaseUrl"
            placeholder="https://your-shortlink-service.example" />
        </div>
        <div class="admin-row">
          <span>Token</span>
          <input
            v-model="shortenToken"
            type="password"
            :placeholder="shortenHasToken ? '已配置，留空不改' : '未配置，必填'" />
        </div>
        <div class="admin-row">
          <button @click="saveShorten" class="admin-btn-primary">保存</button>
        </div>
        </div>
      </section>

      <!-- 账号页 -->
      <section v-if="tab === 'accounts'">
        <h2>账号</h2>
        <p>这里只显示账号名、角色与开关，绝不显示口令或哈希值。</p>
        <div v-if="acctError" class="admin-error">{{ acctError }}</div>
        <div v-if="acctOk" class="admin-ok">{{ acctOk }}</div>
        <div class="admin-box">
          <h3>修改我的密码</h3>
          <p>当前登录：{{ user || "—" }}。已在账号库里的账号直接改库；部署口令账号首次设置时，会在库里为该账号建 admin 行，此后登录口令以库里为准、原部署口令对该账号不再生效。当前登录会话不受影响。</p>
          <div class="admin-row">
            <input
              v-model="myNewPass"
              type="password"
              placeholder="新密码" />
            <input
              v-model="myNewPass2"
              type="password"
              placeholder="确认新密码" />
            <button @click="changeMyPassword" class="admin-btn-primary">保存新密码</button>
          </div>
        </div>
        <ul class="admin-list">
          <li v-for="u in users" :key="u.user" class="admin-user-row">
            <strong>{{ u.user }}</strong>
            <label>角色
              <select v-model="u.role">
                <option value="admin">admin</option>
                <option value="user">user</option>
              </select>
            </label>
            <label><input type="checkbox" v-model="u.enabled" /> 启用</label>
            <label><input type="checkbox" v-model="u.davEnabled" /> DAV</label>
            <input
              v-model="u._newPass"
              type="password"
              placeholder="新密码（留空不改）" />
            <button @click="saveUser(u)">保存</button>
            <button @click="deleteUser(u.user)" class="admin-danger">删除</button>
          </li>
        </ul>
        <div class="admin-box">
          <h3>新建账号</h3>
          <div class="admin-row">
            <input v-model="newAcct.user" placeholder="账号" />
            <input
              v-model="newAcct.password"
              type="password"
              placeholder="密码" />
            <select v-model="newAcct.role">
              <option value="user">user</option>
              <option value="admin">admin</option>
            </select>
            <label><input type="checkbox" v-model="newAcct.davEnabled" /> DAV</label>
            <button @click="createUser" class="admin-btn-primary">新建</button>
          </div>
        </div>
      </section>

      <!-- 权限页 -->
      <section v-if="tab === 'permissions'">
        <h2>权限</h2>
        <p class="admin-rules">规则：无权限即不可见；写包含读；管理员不受规则限制。</p>
        <div v-if="permError" class="admin-error">{{ permError }}</div>
        <div v-if="permOk" class="admin-ok">{{ permOk }}</div>
        <ul class="admin-list">
          <li v-for="r in rules" :key="r.user + '|' + r.prefix">
            <span>{{ r.user }} — {{ r.prefix }} — {{ r.access }}</span>
            <button @click="deleteRule(r)" class="admin-danger">删除</button>
          </li>
        </ul>
        <div v-if="!rules.length && !permError" class="admin-empty">暂无权限规则</div>
        <div class="admin-box">
          <h3>新增规则</h3>
          <div class="admin-row">
            <select v-model="newRule.user">
              <option disabled value="">请选择账号</option>
              <option
                v-for="u in permUserOptions"
                :key="u"
                :value="u">{{ u }}</option>
            </select>
            <span>文件夹：{{ newRule.prefix || "未选择" }}</span>
            <button @click="openPicker('rule')">选择文件夹</button>
            <select v-model="newRule.access">
              <option value="read">read</option>
              <option value="write">write</option>
              <option value="none">none</option>
            </select>
            <button @click="createRule" class="admin-btn-primary">新增</button>
          </div>
        </div>
      </section>

      <section v-if="tab === 'skin'">
        <h2>主题皮肤</h2>
        <p class="admin-desc">皮肤是全站设置，点一下立即换装，其他已打开的页面也会同步换装。默认皮肤为原始主题。</p>
        <div v-if="skinError" class="admin-error">{{ skinError }}</div>
        <div v-if="skinOk" class="admin-ok">{{ skinOk }}</div>
        <div class="admin-skin-cards">
          <div class="admin-skin-card" :class="{ on: skinLocal === 'original' }">
            <h3>原始主题</h3>
            <p>浅色清新语言：青色点缀、半透明面板、圆润字体。</p>
            <span v-if="skinLocal === 'original'" class="admin-skin-current">当前</span>
            <button v-else :disabled="skinSaving" @click="saveSkin('original')" class="admin-btn-primary">设为当前</button>
          </div>
          <div class="admin-skin-card" :class="{ on: skinLocal === 'starship' }">
            <h3>星际航行者</h3>
            <p>深空渐变、星云行星、玻璃拟态，科幻舰桥风。</p>
            <span v-if="skinLocal === 'starship'" class="admin-skin-current">当前</span>
            <button v-else :disabled="skinSaving" @click="saveSkin('starship')" class="admin-btn-primary">设为当前</button>
          </div>
        </div>
      </section>

      <section v-if="tab === 'limits'">
        <h2>上传限制</h2>
        <p class="admin-desc">防恶意上传的额度：单文件上限、每身份每日量、存储总量、过期时间。总量填 0 表示不限量，过期填 0 表示永不过期；其余两项必须大于 0。过期文件在每次上传时顺带清理（每次最多 50 条），总量上限是硬兜底，即使清理延迟也不会冲爆额度。</p>
        <div v-if="limitError" class="admin-error">{{ limitError }}</div>
        <div v-if="limitOk" class="admin-ok">{{ limitOk }}</div>
        <div class="admin-limit-grid">
          <div class="admin-limit-card">
            <div class="admin-limit-label">单文件上限</div>
            <div class="admin-limit-field">
              <input v-model.number="limitMaxFile" type="number" min="1" />
              <span class="admin-limit-unit">MB</span>
            </div>
            <div class="admin-limit-hint">必须大于 0</div>
          </div>
          <div class="admin-limit-card">
            <div class="admin-limit-label">每身份每日量</div>
            <div class="admin-limit-field">
              <input v-model.number="limitDaily" type="number" min="1" />
              <span class="admin-limit-unit">MB</span>
            </div>
            <div class="admin-limit-hint">必须大于 0</div>
          </div>
          <div class="admin-limit-card">
            <div class="admin-limit-label">存储总量</div>
            <div class="admin-limit-field">
              <input v-model.number="limitTotal" type="number" min="0" />
              <span class="admin-limit-unit">MB</span>
            </div>
            <div class="admin-limit-hint">0 = 不限量</div>
          </div>
          <div class="admin-limit-card">
            <div class="admin-limit-label">过期时间</div>
            <div class="admin-limit-field">
              <input v-model.number="limitExpiry" type="number" min="0" />
              <span class="admin-limit-unit">小时</span>
            </div>
            <div class="admin-limit-hint">0 = 永不过期</div>
          </div>
        </div>
        <div class="admin-row">
          <button @click="saveLimits" class="admin-btn-primary">保存</button>
        </div>
      </section>

          <!-- 挂载页 -->
          <section v-if="tab === 'mounts'">
            <h2>挂载</h2>
            <p class="admin-desc">第三方网盘挂载的 OAuth 配置存在这里。配好后，前台「添加挂载」里才会出现对应的入口；停用后入口消失，已绑的挂载不受影响。Client Secret 只保存在服务端，保存时留空表示不改。</p>
            <div v-if="mountError" class="admin-error">{{ mountError }}</div>
            <div v-if="mountOk" class="admin-ok">{{ mountOk }}</div>
            <div class="admin-box">
              <h3>Google Drive</h3>
              <p class="admin-desc">用 Google OAuth2 连接，只读。重定向 URI 须与 Google Cloud Console 里填的一致（本站同源，含尾部斜杠）。</p>
              <div class="admin-row">
                <span class="admin-field-label">启用</span>
                <input type="checkbox" v-model="mountGoogle.enabled" />
                <span class="admin-desc">关掉后前台不再显示 Google Drive 入口</span>
              </div>
              <div class="admin-row">
                <span class="admin-field-label">Client ID</span>
                <input v-model="mountGoogle.clientId" placeholder="xxx.apps.googleusercontent.com" />
              </div>
              <div class="admin-row">
                <span class="admin-field-label">Client Secret</span>
                <input v-model="mountGoogle.clientSecret" type="password" placeholder="留空表示不改" />
                <span v-if="mountGoogle.hasSecret" class="admin-desc">已配置</span>
              </div>
              <div class="admin-row">
                <span class="admin-field-label">重定向 URI</span>
                <input v-model="mountGoogle.redirectUri" placeholder="https://pan.nesive.com/" />
              </div>
              <div class="admin-row">
                <span class="admin-field-label">作用域</span>
                <span class="admin-scope" title="只读：授权时固定请求此作用域">{{ mountGoogle.scopes.length ? mountGoogle.scopes.join(', ') : 'https://www.googleapis.com/auth/drive.readonly（默认只读）' }}</span>
              </div>
              <div class="admin-row">
                <button @click="saveMount('google-drive')" class="admin-btn-primary" :disabled="mountSaving">{{ mountSaving ? '保存中…' : '保存' }}</button>
              </div>
            </div>
            <div class="admin-box">
              <h3>OneDrive <span class="admin-coming">即将推出</span></h3>
              <p class="admin-desc">OneDrive 挂载正在开发中，配置入口稍后开放。</p>
            </div>
            <div class="admin-box">
              <h3>Dropbox <span class="admin-coming">即将推出</span></h3>
              <p class="admin-desc">Dropbox 挂载正在开发中，配置入口稍后开放。</p>
            </div>
          </section>
        </main>
      </div>
    </div>
    <!-- 文件夹选择器：受保护增加、分享、规则、移动四处共用，单选，确认才写回 -->
    <div
      v-if="pickerOpen"
      class="admin-picker-backdrop"
      @click.self="closePicker">
      <div class="admin-picker">
        <h3>选择文件夹</h3>
        <p
          v-if="pickerTarget === 'move'"
          class="admin-desc">选择移动目标文件夹，或选根目录。</p>
        <div v-if="pickerRootLoading">正在加载文件夹…</div>
        <div v-else-if="pickerRootError" class="admin-error">{{ pickerRootError }} <button @click="loadPickerRoot">重试</button></div>
        <ul v-else class="admin-list">
          <li
            v-if="pickerTarget === 'move'"
            class="admin-picker-row"
            :class="{ 'admin-picker-selected': pickerSelected === '' }"
            @click="pickerSelected = ''">
            <span class="admin-tree-icon"><FolderIcon /></span>
            <span class="admin-name">根目录（/）</span>
          </li>
          <li v-for="row in pickerRows" :key="row.key">
            <template v-if="row.kind === 'folder'">
              <div class="admin-tree-row admin-picker-row" :class="{ 'admin-picker-selected': pickerSelected === row.prefix }" :style="{ paddingLeft: (row.depth * 16) + 'px' }" @click="pickerSelected = row.prefix">
                <button class="admin-tree-exp" :disabled="!!pickerLoading[row.prefix]" @click.stop="togglePickerNode(row)">{{ pickerExpanded[row.prefix] ? "▾" : "▸" }}</button>
                <span class="admin-tree-icon"><FolderIcon /></span>
                <span
                  class="admin-name">{{ folderDisplayName(row.prefix) }}</span>
              </div>
              <div v-if="pickerLoading[row.prefix]" class="admin-tree-status" :style="{ paddingLeft: (row.depth * 16 + 32) + 'px' }">加载中…</div>
              <div v-if="pickerFailed.includes(row.prefix)" class="admin-tree-status" :style="{ paddingLeft: (row.depth * 16 + 32) + 'px' }">加载失败，点击 ▸ 重试</div>
            </template>
            <div
              v-else
              class="admin-tree-empty"
              :style="{ paddingLeft: (row.depth * 16 + 32) + 'px' }">空文件夹</div>
          </li>
        </ul>
        <div v-if="!pickerRootLoading && !pickerRootError && !pickerRows.length && pickerTarget !== 'move'" class="admin-empty">暂无文件夹</div>
        <div class="admin-row">
          <span>已选：{{ pickerTarget === 'move' && pickerSelected === '' ? '根目录（/）' : (pickerSelected || '未选择') }}</span>
          <button
            @click="confirmPicker"
            :disabled="pickerTarget !== 'move' && !pickerSelected"
            class="admin-btn-primary">确认</button>
          <button @click="closePicker">取消</button>
        </div>
      </div>
    </div>
    <!-- 手动复制兜底框：剪贴板两种写法都失败时用（替代 window.prompt，
         prompt 在微信等内置浏览器里常被屏蔽、点完无反应）。 -->
    <div
      v-if="showManualCopy"
      class="admin-picker-backdrop"
      @click.self="closeManualCopy">
      <div class="admin-picker">
        <h3>{{ manualCopyTitle }}</h3>
        <input
          ref="manualCopyInput"
          :value="manualCopyText"
          readonly
          class="manual-copy-input"
          @focus="$event.target.select()"
          @click="$event.target.select()" />
        <p class="admin-desc">长按 / 右键可手动复制上面整段地址。</p>
        <div class="admin-row">
          <button @click="closeManualCopy" class="admin-btn-primary">关闭</button>
        </div>
      </div>
    </div>
    <!-- 删除文件夹确认框：自定义弹窗替代原生 window.confirm。
         原生确认框在各浏览器长相不一、且无法展示对象数与关联项，
         改为与手动复制框同款的 admin-picker 弹窗；点遮罩或取消关闭。 -->
    <div
      v-if="deleteConfirm"
      class="admin-picker-backdrop"
      @click.self="closeDeleteConfirm">
      <div class="admin-picker admin-delete-confirm">
        <div class="admin-delete-confirm-head">
          <span class="admin-delete-confirm-icon">!</span>
          <h3>删除文件夹</h3>
        </div>
        <p class="admin-delete-confirm-name">{{ deleteConfirm.name }}</p>
        <p class="admin-delete-confirm-desc">
          其中包含 {{ deleteConfirm.info.count }} 个对象<span v-if="deleteConfirm.info.truncated">（仅统计前 1000 个）</span>，删除后无法恢复。
        </p>
        <ul
          v-if="deleteConfirm.info.shares || deleteConfirm.info.permissions || deleteConfirm.info.protected"
          class="admin-delete-confirm-list">
          <li v-if="deleteConfirm.info.shares">关联的分享 {{ deleteConfirm.info.shares }} 个将被一并删除（含短链撤销）。</li>
          <li v-if="deleteConfirm.info.permissions">关联的权限规则 {{ deleteConfirm.info.permissions }} 条将被一并删除。</li>
          <li v-if="deleteConfirm.info.protected">其中 {{ deleteConfirm.info.protected }} 个子文件夹的保护将被一并解除。</li>
        </ul>
        <div class="admin-row admin-delete-confirm-actions">
          <button @click="closeDeleteConfirm">取消</button>
          <button
            @click="confirmDeleteFolder"
            :disabled="deleteConfirmBusy"
            class="admin-btn-danger">{{ deleteConfirmBusy ? '删除中…' : '删除' }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import MimeIcon from './MimeIcon.vue';
import { copyTextToClipboard, multipartUpload } from '/assets/main.mjs';

// 前端文件列表用的文件夹图标原物（App.vue 内联 SVG，viewBox 0 0 576 512），
// 管理后台文件行与受保护勾选行直接复用同一图形，不再用 emoji 占位。
const FolderIcon = {
  template: `<svg viewBox="0 0 576 512" xmlns="http://www.w3.org/2000/svg" width="36" height="36"><path d="M384 480l48 0c11.4 0 21.9-6 27.6-15.9l112-192c5.8-9.9 5.8-22.1 .1-32.1S555.5 224 544 224l-400 0c-11.4 0-21.9 6-27.6 15.9L48 357.1 48 96c0-8.8 7.2-16 16-16l117.5 0c4.2 0 8.3 1.7 11.3 4.7l26.5 26.5c21 21 49.5 32.8 79.2 32.8L416 144c8.8 0 16 7.2 16 16l0 32 48 0 0-32c0-35.3-28.7-64-64-64L298.5 96c-17 0-33.3-6.7-45.3-18.7L226.7 50.7c-12-12-28.3-18.7-45.3-18.7L64 32C28.7 32 0 60.7 0 96L0 416c0 35.3 28.7 64 64 64l23.7 0L384 480z"/></svg>`,
};

export default {
  components: { MimeIcon, FolderIcon },
  data: () => ({
    view: 'login',
    tab: 'overview',
    user: null,
    loginUser: '',
    loginPass: '',
    loginError: '',
    loginBusy: false,
    globalError: '',
    // 概览（GET /api/admin/overview）：存储、分享、挂载、账号四个数
    // + 最近动态；登录后默认落地页。
    overview: null,
    overviewLoading: false,
    overviewError: '',
    // 挂载（GET/POST /api/admin/mounts）：OAuth 配置。clientSecret
    // 只在保存时发，留空表示不改；服务端只回 hasSecret，绝不回显。
    mountGoogle: { enabled: false, clientId: '', clientSecret: '', redirectUri: '', scopes: [], hasSecret: false },
    mountLoading: false,
    mountSaving: false,
    mountError: '',
    mountOk: '',
    // 文件
    cwd: '',
    files: [],
    folders: [],
    filesLoading: false,
    filesError: '',
    // 请求序号 guard：快速连点文件夹时，旧响应后到直接丢弃。
    adminFetchSeq: 0,
    uploadError: '',
    uploadSummary: '',
    uploadQueue: [],
    uploadQueueSeq: 0,
    uploading: false,
    uploadLoginExpired: false,
    uploadBatchIds: [],
    uploadBatchIndex: 0,
    uploadBatchCount: 0,
    uploadBatchLoaded: 0,
    uploadBatchTotal: 0,
    newFolderName: '',
    actionError: '',
    actionOk: '',
    // 受保护
    protList: [],
    protPick: '',
    protError: '',
    protOk: '',
    protCorrupted: false,
    protBusy: false,
    protTopFolders: [],
    protFoldersLoading: false,
    protFoldersError: '',
    // 文件树：扁平可见行（kind: folder | empty），展开按需拉子文件夹；
    // 子级缓存于 protTreeChildren，折叠只收行不丢缓存；失败节点进 protTreeFailed。
    protTreeRows: [],
    protTreeChildren: {},
    protTreeExpanded: {},
    protTreeLoading: {},
    protTreeFailed: [],
    // 服务端重载代次：勾选框的 DOM 状态会被浏览器原生点击改写，Vue 的 :checked
    // diff 看不到这次改动，失败重载时必须靠 key 换代重建输入框才能复原服务端真相。
    protSeq: 0,
    // 文件夹选择器：受保护增加、分享、规则、移动四处共用；单选，确认才写回。
    // 树状态与受保护树互相独立（各自的缓存与展开态），互不干扰。
    pickerOpen: false,
    pickerTarget: '',
    pickerSelected: '',
    pickerMoveKey: '',
    pickerTopFolders: [],
    pickerRootLoading: false,
    pickerRootError: '',
    pickerRows: [],
    pickerChildren: {},
    pickerExpanded: {},
    pickerLoading: {},
    pickerFailed: [],
    // WebDAV
    davEnabled: null,
    davSwitchBusy: false,
    davError: '',
    davOk: '',
    davCopyOk: '',
    // 短链（总开关：关闭时全部短链入口与配置区隐藏，开关本身常驻）。
    shortenEnabled: true,
    // Theme skin: site-wide setting stored in D1 settings (key skin).
    skinLocal: 'original',
    skinSaving: false,
    skinError: '',
    skinOk: '',
    shortenSwitchBusy: false,
    shortenBaseUrl: '',
    shortenToken: '',
    shortenHasToken: false,
    shortenConfigured: false,
    shortenSource: 'none',
    shortenCorrupted: false,
    shortenError: '',
    shortenOk: '',
    // 分享
    shares: [],
    shareForm: { prefix: '', code: '', expiresIn: '30d' },
    shareResult: null,
    shareError: '',
    shareOk: '',
    shareWarn: '',
    // 手动复制兜底框（剪贴板两种写法都失败时用，替代 window.prompt）。
    showManualCopy: false,
    manualCopyTitle: '',
    manualCopyText: '',
    // 删除文件夹确认框：自定义弹窗替代原生 window.confirm。
    // deleteConfirm 为 null 时不显示；非 null 时为
    // { folder, name, info }，info 是 delete-folder preview 的回包。
    deleteConfirm: null,
    deleteConfirmBusy: false,
    shareBusy: false,
    shareFilterPrefix: 'all',
    shareFilterStatus: 'all',
    shareExpanded: {},
    shareShortlinks: {},
    shareShortlinksLoading: {},
    shareShortlinksError: {},
    // 账号
    users: [],
    acctError: '',
    acctOk: '',
    myNewPass: '',
    myNewPass2: '',
    newAcct: { user: '', password: '', role: 'user', davEnabled: false },
    // 权限
    rules: [],
    permError: '',
    permOk: '',
    newRule: { user: '', prefix: '', access: 'read' },
    // 上传限制
    limitMaxFile: 500,
    limitDaily: 2048,
    limitTotal: 0,
    limitExpiry: 0,
    limitError: '',
    limitOk: '',
  }),

  computed: {
    // 侧栏四组：内容 / 连接 / 访问 / 系统。角标只给有明确数量的项
    //（文件对象数、分享数、已启用挂载数、账号数），其余不显示。
    navGroups() {
      const o = this.overview;
      return [
        { id: 'content', label: '内容', items: [
          { id: 'files', label: '文件', badge: o ? o.storage.fileCount : null },
          { id: 'shares', label: '分享', badge: o ? o.shares.count : null },
          { id: 'shorten', label: '短链', badge: null },
        ] },
        { id: 'connection', label: '连接', items: [
          { id: 'dav', label: 'WebDAV', badge: null },
          { id: 'mounts', label: '挂载', badge: o ? o.mounts.enabled.length : null },
        ] },
        { id: 'access', label: '访问', items: [
          { id: 'accounts', label: '账号', badge: o ? o.accounts.count : null },
          { id: 'permissions', label: '权限', badge: null },
          { id: 'protection', label: '受保护文件夹', badge: null },
        ] },
        { id: 'system', label: '系统', items: [
          { id: 'limits', label: '上传限制', badge: null },
          { id: 'skin', label: '主题皮肤', badge: null },
        ] },
      ];
    },

    // 存储已用百分比（不限量时为 0）。
    storagePct() {
      const o = this.overview;
      if (!o || !o.storage.totalMb) return 0;
      const total = o.storage.totalMb * 1024 * 1024;
      if (!total) return 0;
      return Math.min(100, Math.round((o.storage.totalBytes / total) * 100));
    },

    // 概览一句话：最值得注意的那件事，优先报存储告急。
    overviewSentence() {
      const o = this.overview;
      if (!o) return '';
      if (o.storage.totalMb && this.storagePct >= 90) {
        return '存储快满了（已用 ' + this.storagePct + '%），先清一清再传新文件。';
      }
      if (o.mounts.enabled.length) {
        return o.mounts.enabled.map((p) => p.name).join('、') + ' 已接好，存储用了 ' + (o.storage.totalMb ? this.storagePct + '%' : '不限量') + '，一切正常。';
      }
      if (o.shares.count) {
        return '有 ' + o.shares.count + ' 条分享在跑，存储用了 ' + (o.storage.totalMb ? this.storagePct + '%' : '不限量') + '。';
      }
      return '一切正常，存储' + (o.storage.totalMb ? '用了 ' + this.storagePct + '%' : '不限量') + '。';
    },

    // 侧栏底部状态行：绿点 = 服务正常。
    overviewOk() {
      return !!this.overview && !this.overviewError;
    },
    overviewStatusText() {
      if (this.overviewLoading) return '正在加载…';
      if (this.overviewError) return '服务异常';
      if (this.overview) return '服务正常';
      return '未加载';
    },

    davAddr() {
      return window.location.origin + '/dav';
    },

    shortenSourceText() {
      if (this.shortenSource === 'admin') return '后台配置';
      if (this.shortenSource === 'env') return '环境变量';
      return '未配置';
    },

    shareResultLink() {
      return this
      .shareResult ? window
      .location
      .origin + this
      .shareResult
      .shareUrl : '';
    },

    shareFilterPrefixes() {
      const seen = {};
      this.shares.forEach((s) => { seen[s.prefix] = true; });
      return Object.keys(seen).sort();
    },

    filteredShares() {
      return this.shares.filter((s) => {
        if (this.shareFilterPrefix !== 'all'
          && s.prefix !== this.shareFilterPrefix) return false;
        if (this.shareFilterStatus !== 'all'
          && this.shareStatus(s) !== this.shareFilterStatus) return false;
        return true;
      });
    },

    hasFailedRows() {
      return this.uploadQueue.some((row) => row.status === 'failed'
        || row.status === 'cleaned');
    },

    hasDoneRows() {
      return this.uploadQueue.some((row) => row.status === 'done');
    },

    totalPercent() {
      if (!this.uploadBatchTotal) return 0;
      return Math.min(100,
        Math.round((this.uploadBatchLoaded / this.uploadBatchTotal) * 100));
    },

    // 规则账号下拉选项：D1 账号表 + 当前登录账号（env-admin 可能不在表里，
    // 不补进来的话它反而建不了规则）。
    permUserOptions() {
      const names = this.users.map((u) => u.user);
      if (this.user && !names.includes(this.user)) names.push(this.user);
      return names;
    },

    // 树里管不到的已保护前缀：树外孤 prefix（文件夹已删）与加载失败分支下的
    // prefix；树内子目录已由树行管理，不再重复进组。存储的前缀都以 / 结尾，
    // startsWith 不会把 App2/ 误算成 App/ 的子级。
    protOther() {
      return this.protList.filter((p) => {
        if (this.protTopFolders.includes(p)) return false;
        if (this.protTreeFailed.some((f) => p !== f
        && p.startsWith(f))) return true;
        if (this.protTopFolders.some((t) => p.startsWith(t))) return false;
        return true;
      });
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

    async readJson(res) {
      try {
        return await res.json();
      } catch (e) {
        return {};
      }
    },

    goLogin(msg) {
      this.view = 'login';
      this.user = null;
      if (msg) this.loginError = msg;
    },

    async checkStatus() {
      try {
        const res = await fetch('/api/auth/status');
        const data = await this.readJson(res);
        if (res.ok && data.loggedIn) {
          this.user = data.user;
          this.view = 'console';
          this.fetchFilesAdmin();
        } else {
          this.view = 'login';
        }
      } catch (e) {
        this.view = 'login';
      }
    },

    async doLogin() {
      this.loginError = '';
      this.loginBusy = true;
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: this.loginUser,
          password: this.loginPass }),
        });
        if (res.status === 401) {
          this.loginError = '账号或密码错误';
          return;
        }
        if (!res.ok) {
          this.loginError = '登录失败，请重试';
          return;
        }
        // 登录成功后用状态接口确认身份再进控制台
        const st = await fetch('/api/auth/status');
        const data = await this.readJson(st);
        if (!st.ok || !data.loggedIn) {
          this.loginError = '登录失败，请重试';
          return;
        }
        this.user = data.user;
        this.loginPass = '';
        this.view = 'console';
        this.tab = 'overview';
        this.loadOverview();
      } catch (e) {
        this.loginError = '登录失败，请重试';
      } finally {
        this.loginBusy = false;
      }
    },

    async doLogout() {
      try {
        await fetch('/api/auth/logout', { method: 'POST' });
      } catch (e) { /* 退出失败也回到登录页，不静默 */ }
      this.view = 'login';
      this.user = null;
      this.loginPass = '';
    },

    async saveSkin(skin) {
      this.skinError = '';
      this.skinOk = '';
      this.skinSaving = true;
      try {
        const res = await fetch('/api/admin/skin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ skin }),
        });
        if (res.status === 401) {
          this.goLogin('登录已失效，请重新登录');
          return;
        }
        if (!res.ok) {
          const data = await this.readJson(res);
          this.skinError = data.error ? `保存失败：${data.error}`
              : '保存失败，请重试';
          return;
        }
        const data = await res.json();
        this.skinLocal = data.skin || skin;
        try { localStorage.setItem('pan-skin', this.skinLocal); }
        catch (e) {}
        // 一键换装：保存成功即在当前页生效，不用刷新。
        this.applySkin(this.skinLocal);
        this.skinOk = '已切换，全站即时生效';
      } catch (e) {
        this.skinError = '保存失败，请重试';
      } finally {
        this.skinSaving = false;
      }
    },

    switchTab(t) {
      this.tab = t;
      this.globalError = '';
      if (t === 'overview') this.loadOverview();
      if (t === 'files') this.fetchFilesAdmin();
      if (t === 'protection') { this.loadProtection(); this.loadProtFolders(); }
      if (t === 'shares') this.loadShares();
      if (t === 'dav') this.loadDav();
      if (t === 'shorten') this.loadShorten();
      if (t === 'accounts') this.loadAccounts();
      if (t === 'permissions') {
        this.loadPermissions();
        if (!this.users.length) this.loadAccounts();
      }
      if (t === 'limits') this.loadLimits();
      if (t === 'mounts') this.loadMounts();
    },

    // 概览：四个数 + 最近动态（GET /api/admin/overview）。
    async loadOverview() {
      if (this.overviewLoading) return;
      this.overviewLoading = true;
      this.overviewError = '';
      try {
        const res = await fetch('/api/admin/overview');
        if (res.status === 401) {
          this.goLogin('登录已失效，请重新登录');
          return;
        }
        const data = await this.readJson(res);
        if (!res.ok) {
          this.overviewError = '加载失败，请重试';
          return;
        }
        this.overview = data;
      } catch (e) {
        this.overviewError = '加载失败，请重试';
      } finally {
        this.overviewLoading = false;
      }
    },

    // 挂载配置：GET 全部提供商状态（Secret 只回 hasSecret）。
    async loadMounts() {
      if (this.mountLoading) return;
      this.mountLoading = true;
      this.mountError = '';
      try {
        const res = await fetch('/api/admin/mounts');
        if (res.status === 401) {
          this.goLogin('登录已失效，请重新登录');
          return;
        }
        const data = await this.readJson(res);
        if (!res.ok) {
          this.mountError = '加载失败，请重试';
          return;
        }
        const g = (data.providers || []).find((p) => p.id === 'google-drive');
        if (g) {
          this.mountGoogle = {
            enabled: !!g.enabled,
            clientId: g.clientId || '',
            clientSecret: '',
            redirectUri: g.redirectUri || '',
            scopes: Array.isArray(g.scopes) ? g.scopes : [],
            hasSecret: !!g.hasSecret,
          };
        }
      } catch (e) {
        this.mountError = '加载失败，请重试';
      } finally {
        this.mountLoading = false;
      }
    },

    // 保存某提供商的挂载配置：Secret 留空表示保持现有值。
    async saveMount(provider) {
      this.mountError = '';
      this.mountOk = '';
      this.mountSaving = true;
      try {
        const body = { provider };
        if (provider === 'google-drive') {
          body.enabled = !!this.mountGoogle.enabled;
          body.client_id = String(this.mountGoogle.clientId || '').trim();
          body.client_secret = String(this.mountGoogle.clientSecret || '');
          body.redirect_uri = String(this.mountGoogle.redirectUri || '').trim();
        }
        const res = await fetch('/api/admin/mounts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (res.status === 401) {
          this.goLogin('登录已失效，请重新登录');
          return;
        }
        const data = await this.readJson(res);
        if (!res.ok) {
          this.mountError = (data && data.error) || '保存失败，请重试';
          return;
        }
        if (provider === 'google-drive') {
          this.mountGoogle.clientSecret = '';
          this.mountGoogle.hasSecret = !!(data.provider && data.provider.hasSecret);
        }
        this.mountOk = '已保存';
        // 配置变了，概览的挂载数也变了，下次进概览会重拉。
        this.overview = null;
      } catch (e) {
        this.mountError = '保存失败，请重试';
      } finally {
        this.mountSaving = false;
      }
    },

    // Unix 秒时间戳 → 本地「YYYY-MM-DD HH:mm」。
    formatTime(ts) {
      if (!ts) return '';
      const d = new Date(ts * 1000);
      const p = (n) => String(n).padStart(2, '0');
      return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
    },

    formatSize(size) {
      const units = ['B', 'KB', 'MB', 'GB', 'TB'];
      let i = 0;
      let v = size || 0;
      while (v >= 1024) {
        v /= 1024;
        i++;
      }
      return `${v.toFixed(1)} ${units[i]}`;
    },

    // 与前端一致：只显示文件夹最后一段（"Backup/" → "Backup"）
    folderDisplayName(f) {
      const m = (f || '').match(/.*?([^/]*)\/?$/);
      return m ? m[1] : f;
    },

    // 文件夹标记（"_$folder$"）是存储层内部对象：服务端各列表
    // 已过滤，这里再兜底一道，防服务端回归或缓存旧响应。
    withoutMarkerKeys(list) {
      return (list || []).filter((k) =>
        !String(k || '').split('/').includes('_$folder$'));
    },

    formatDate(t) {
      if (!t) return '—';
      const d = new Date(t);
      return isNaN(d.getTime()) ? '—' : d.toLocaleString();
    },

    // ---- 文件 ----
    async fetchFilesAdmin() {
      // 请求序号 guard：快速连点文件夹时，旧响应后到直接丢弃。
      // 不加缓存：上传/改名/移动/删除后每次都重新请求，数据一定新鲜；
      // 加载时旧列表保留在界面上（见模板），只换新数据。
      // fetch 加 no-store：/api/children/ 不带显式 Cache-Control 时
      // 浏览器可能启发式缓存 GET 响应，删除后重拉会拿到含已删文件
      // 夹的旧列表（已删文件夹仍显示、点进去报「不存在」）；no-store
      // 保证每次重拉都直达服务端。
      const seq = ++this.adminFetchSeq;
      this.filesLoading = true;
      this.filesError = '';
      try {
        const res = await fetch(`/api/children/${this.cwd}`, { cache: 'no-store' });
        if (seq !== this.adminFetchSeq) return;
        if (res.status === 401) {
          this.goLogin('登录已失效，请重新登录');
          return;
        }
        if (!res.ok) throw new Error('http_' + res.status);
        const data = await this.readJson(res);
        if (seq !== this.adminFetchSeq) return;
        // 文件夹标记（"_$folder$"）是存储层内部对象：服务端各列表
        // 已过滤，这里再兜底一道，防服务端回归或缓存旧响应。
        this.files = (data.value || []).filter((f) =>
          !String(f.key || '').split('/').includes('_$folder$'));
        this.folders = this.withoutMarkerKeys(data.folders);
      } catch (e) {
        if (seq !== this.adminFetchSeq) return;
        this.files = [];
        this.folders = [];
        this.filesError = '加载失败，请稍后重试';
      } finally {
        if (seq === this.adminFetchSeq) this.filesLoading = false;
      }
    },

    goUp() {
      this.cwd = this.cwd.replace(/[^\/]+\/$/, '');
      this.fetchFilesAdmin();
    },

    uploadStatusText(row) {
      if (row.status === 'queued') return '排队';
      if (row.status === 'uploading') return '上传中';
      if (row.status === 'done') return '成功';
      if (row.status === 'cleaned') return '已清理';
      return '失败';
    },

    uploadErrorText(status, code) {
      if (status === 413 || code === 'upload_too_large') return '单文件超出上限';
      if (status === 429 || code === 'daily_quota_exceeded') {
        return '今日上传额度已满';
      }
      if (status === 507 || code === 'storage_quota_exceeded') {
        return '存储总量已满';
      }
      if (status === 403 || code === 'forbidden') return '无写权限';
      if (status === 401) return '登录失效';
      return '上传失败，请重试';
    },

    pickFiles() {
      const input = this.$refs.uploadInput;
      if (input) input.click();
    },

    onPickFiles() {
      const input = this.$refs.uploadInput;
      if (!input || !input.files) return;
      let dup = 0;
      for (const file of Array.from(input.files)) {
        const exists = this.uploadQueue.some((row) => row.name === file.name
          && row.size === file.size);
        if (exists) {
          dup += 1;
          continue;
        }
        this.uploadQueueSeq += 1;
        this.uploadQueue.push({
          id: this.uploadQueueSeq,
          file,
          name: file.name,
          size: file.size,
          status: 'queued',
          loaded: 0,
          percent: 0,
          error: '',
          note: '',
          cleaned: false,
          existedBefore: null,
          key: '',
        });
      }
      input.value = '';
      this.uploadError = dup
        ? `已跳过 ${dup} 个重复文件（同名同大小已在队列中）`
        : '';
    },

    removeRow(row) {
      this.uploadQueue = this.uploadQueue.filter((item) => item.id !== row.id);
    },

    clearDoneRows() {
      this.uploadQueue = this.uploadQueue.filter(
        (row) => row.status !== 'done');
    },

    updateBatchProgress() {
      let loaded = 0;
      for (const row of this.uploadQueue) {
        if (!this.uploadBatchIds.includes(row.id)) continue;
        loaded += row.status === 'done' ? row.size : row.loaded;
      }
      this.uploadBatchLoaded = loaded;
    },

    // Admin upload via R2 multipart (same helper as the main frontend):
    // the old single-POST carried the whole file in one request, which
    // Cloudflare's edge rejects with 413 once the body exceeds the plan
    // limit (100 MB on Free/Pro) — long before the configured per-file
    // cap (500 MB) is ever evaluated. Chunking at 50 MB keeps every
    // request under that edge ceiling with margin; the server still
    // enforces the configured per-file/daily/total caps at create and
    // at complete time, so quota behavior is unchanged.
    async uploadOneFile(row) {
      const key = this.cwd + row.file.name;
      try {
        await multipartUpload(key, row.file, {
          chunkSize: 50 * 1000 * 1000,
          onUploadProgress: (e) => {
            row.loaded = e.loaded;
            row.percent = row.size
              ? Math.min(100, Math.round((e.loaded / row.size) * 100))
              : 0;
            this.updateBatchProgress();
          },
        });
        row.status = 'done';
        row.loaded = row.size;
        row.percent = 100;
        row.error = '';
        row.note = '';
        row.key = key;
        this.updateBatchProgress();
        return true;
      } catch (err) {
        const status = err && err.response ? err.response.status : 0;
        const code = err && err.response && err.response.data
          ? err.response.data.error
          : '';
        if (status === 401) {
          this.uploadLoginExpired = true;
          this.goLogin('登录已失效，请重新登录');
          row.status = 'failed';
          row.error = '登录失效';
          return false;
        }
        row.status = 'failed';
        row.error = this.uploadErrorText(status, code);
        return false;
      }
    },

    async autoCleanupRow(row) {
      // Only clean when the failed attempt reported where it wrote:
      // without a key and existedBefore flag, cleanup could target the
      // wrong object, so it is skipped and the row stays retryable.
      if (!row.key || typeof row.existedBefore !== 'boolean') {
        row.note = '可重试';
        return;
      }
      try {
        const res = await fetch('/api/admin/files/cleanup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            key: row.key,
            existedBefore: row.existedBefore,
          }),
        });
        if (res.status === 401) {
          this.goLogin('登录已失效，请重新登录');
          row.note = '可重试';
          return;
        }
        const data = await this.readJson(res);
        if (!res.ok) {
          row.note = '清理失败，可重试';
          return;
        }
        if (data.deletedObject || data.deletedReservations) {
          row.status = 'cleaned';
          row.cleaned = true;
          row.note = '已清理残留，可重试';
        } else if (data.reason === 'has_ledger') {
          row.note = '已有账本记录，对象与账本未动，可重试';
        } else if (data.reason === 'existed_before') {
          row.note = '上传前文件已存在，未动旧文件，可重试';
        } else {
          row.note = '无残留，可重试';
        }
      } catch (e) {
        row.note = '清理失败，可重试';
      }
    },

    async runUploadRows(rows) {
      if (this.uploading) return null;
      this.uploading = true;
      this.uploadError = '';
      this.uploadSummary = '';
      this.uploadLoginExpired = false;
      this.uploadBatchIds = rows.map((row) => row.id);
      this.uploadBatchTotal = rows.reduce((sum, row) => sum + row.size, 0);
      this.uploadBatchCount = rows.length;
      this.uploadBatchIndex = 0;
      this.uploadBatchLoaded = 0;
      let ok = 0;
      let fail = 0;
      for (const row of rows) {
        if (this.uploadLoginExpired) break;
        this.uploadBatchIndex += 1;
        row.status = 'uploading';
        row.loaded = 0;
        row.percent = 0;
        row.error = '';
        row.note = '';
        row.cleaned = false;
        const done = await this.uploadOneFile(row);
        if (this.uploadLoginExpired) break;
        if (done) {
          ok += 1;
        } else {
          fail += 1;
          await this.autoCleanupRow(row);
        }
        this.updateBatchProgress();
      }
      this.uploading = false;
      if (!this.uploadLoginExpired) {
        this.uploadSummary = `${ok} 个成功，${fail} 个失败`;
        if (ok) this.fetchFilesAdmin();
      }
      return { ok, fail };
    },

    async startUploadBatch() {
      const rows = this.uploadQueue.filter((row) => row.status === 'queued'
        || row.status === 'failed' || row.status === 'cleaned');
      if (!rows.length) {
        this.uploadError = '没有可上传的文件';
        return;
      }
      await this.runUploadRows(rows);
    },

    async retryRow(row) {
      await this.runUploadRows([row]);
    },

    async retryAllFailed() {
      const rows = this.uploadQueue.filter((row) => row.status === 'failed'
        || row.status === 'cleaned');
      if (rows.length) await this.runUploadRows(rows);
    },

    async cleanAndRetryRow(row) {
      if (this.uploading) return;
      if (row.key && typeof row.existedBefore === 'boolean') {
        try {
          const res = await fetch('/api/admin/files/cleanup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              key: row.key,
              existedBefore: row.existedBefore,
            }),
          });
          if (res.status === 401) {
            this.goLogin('登录已失效，请重新登录');
            return;
          }
        } catch (e) {
          // 清理失败仍继续重试：新上传会重新判断并回滚自身残留。
        }
      }
      await this.runUploadRows([row]);
    },

    async adminFileAction(body) {
      this.actionError = '';
      this.actionOk = '';
      try {
        const res = await fetch('/api/admin/files/action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (res.status === 401) {
          this.goLogin('登录已失效，请重新登录');
          return false;
        }
        if (!res.ok) {
          const data = await this.readJson(res);
          this.actionError = data.error ? `操作失败：${data.error}` : '操作失败，请重试';
          return false;
        }
        return true;
      } catch (e) {
        this.actionError = '操作失败，请重试';
        return false;
      }
    },

    async deleteItem(key) {
      if (!window.confirm(`确定要删除 ${key} 吗？`)) return;
      if (await this.adminFileAction({ action: 'delete', key })) {
        this.actionOk = '已删除';
        this.fetchFilesAdmin();
      }
    },

    async renameItem(key) {
      const name = window.prompt('重命名为：', key.split('/').pop());
      if (!name) return;
      const dir = key.slice(0, key.length - key.split('/').pop().length);
      if (await this.adminFileAction({ action: 'rename',
      key,
      target: dir + name })) {
        this.actionOk = '已改名';
        this.fetchFilesAdmin();
      }
    },

    // 文件夹同级改名：只改最后一段，不跨目录移动。f 带尾斜杠
    // （如 "docs/sub/"），后端 key/target 不带尾斜杠。
    async renameFolder(prefix) {
      const name = window.prompt('重命名为：', this.folderDisplayName(prefix));
      if (!name) return;
      const folder = prefix.replace(/\/$/, '');
      const parent = folder.slice(0, folder.length
        - folder.split('/').pop().length);
      if (await this.adminFileAction({ action: 'rename-folder',
      key: folder,
      target: parent + name })) {
        this.actionOk = '已改名';
        this.fetchFilesAdmin();
      }
    },

    // 删除文件夹：先向后端预览（只计数、不删除），把真实对象数
    // 与关联的分享/权限/保护写进确认框；确认后才真正递归删除。
    // 受保护的文件夹后端直接拒绝，前端据此提示先去取消保护。
    async deleteFolderPreview(key) {
      this.actionError = '';
      try {
        const res = await fetch('/api/admin/files/action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'delete-folder', key, preview: true }),
        });
        if (res.status === 401) {
          this.goLogin('登录已失效，请重新登录');
          return null;
        }
        const data = await this.readJson(res);
        if (!res.ok) {
          this.actionError = this.deleteFolderErrorText(data && data.error);
          return null;
        }
        return data;
      } catch (e) {
        this.actionError = '操作失败，请重试';
        return null;
      }
    },

    deleteFolderErrorText(code) {
      if (code === 'protected_folder') {
        return '该文件夹受保护，删除前请先在「受保护文件夹」页取消保护';
      }
      if (code === 'not_found') return '文件夹不存在或已被删除';
      if (code === 'forbidden') return '没有删除权限';
      if (code === 'invalid_key') return '文件夹路径无效';
      return code ? `操作失败：${code}` : '操作失败，请重试';
    },

    // 删除文件夹：先向后端预览（只计数、不删除），把真实对象数
    // 与关联的分享/权限/保护写进自定义确认框；点「删除」后才真正
    // 递归删除。受保护的文件夹后端直接拒绝，前端据此提示先去取消保护。
    async deleteFolder(prefix) {
      const folder = prefix.replace(/\/$/, '');
      const name = this.folderDisplayName(prefix);
      const info = await this.deleteFolderPreview(folder);
      if (!info) return;
      this.deleteConfirmBusy = false;
      this.deleteConfirm = { folder, name, info };
    },

    closeDeleteConfirm() {
      if (this.deleteConfirmBusy) return;
      this.deleteConfirm = null;
    },

    async confirmDeleteFolder() {
      const pending = this.deleteConfirm;
      if (!pending || this.deleteConfirmBusy) return;
      this.deleteConfirmBusy = true;
      this.actionError = '';
      try {
        const res = await fetch('/api/admin/files/action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'delete-folder', key: pending.folder }),
        });
        if (res.status === 401) {
          this.deleteConfirm = null;
          this.deleteConfirmBusy = false;
          this.goLogin('登录已失效，请重新登录');
          return;
        }
        const data = await this.readJson(res);
        if (!res.ok) {
          this.deleteConfirm = null;
          this.deleteConfirmBusy = false;
          this.actionError = this.deleteFolderErrorText(data && data.error);
          return;
        }
        this.actionOk = `已删除文件夹 ${pending.name}（${data.deleted || 0} 个对象）`
          + (data.sinkFailures && data.sinkFailures.length
            ? `，但 ${data.sinkFailures.length} 个短链未能撤销，请在短链管理里手动清理`
            : '');
        // 删除后列表立即刷新：先乐观地把该文件夹从当前列表里拿掉，
        // 让它当场消失；再向服务端重拉一份权威列表对齐。
        // 只乐观移除是不够的——若服务端重拉拿到的是浏览器缓存的旧
        // 列表，已删文件夹会重新出现，所以重拉走 no-store。
        const key = pending.folder + '/';
        this.folders = (this.folders || []).filter((f) => f !== key);
        this.deleteConfirm = null;
        this.deleteConfirmBusy = false;
        this.fetchFilesAdmin();
      } catch (e) {
        this.deleteConfirm = null;
        this.deleteConfirmBusy = false;
        this.actionError = '操作失败，请重试';
      }
    },

    // 移动目标走文件夹选择器：选中文件夹即目标，根目录选项对应留空；
    // 取消不做任何事。目标文件名由确认时拼接。
    moveItem(key) {
      this.pickerMoveKey = key;
      this.openPicker('move');
    },

    async mkdirItem() {
      const name = (this.newFolderName || '').trim();
      if (!name) {
        this.actionError = '请先输入文件夹名称';
        return;
      }
      if (await this.adminFileAction({ action: 'mkdir',
      key: this.cwd + name + '/' })) {
        this.actionOk = '文件夹已创建';
        this.newFolderName = '';
        this.fetchFilesAdmin();
      }
    },

    async copyShortLink(target) {
      if (!this.shortenEnabled) return;
      this.actionError = '';
      try {
        const res = await fetch('/api/shorten', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ target }),
        });
        const data = await this.readJson(res);
        if (res.status === 401) {
          this.goLogin('登录已失效，请重新登录');
          return;
        }
        if (!res.ok || !data.shortLink) {
          this.actionError = data.error ? `复制短链失败：${data.error}` : '复制短链失败，请重试';
          return;
        }
        if (await copyTextToClipboard(data.shortLink)) {
          this.actionOk = '短链已复制：' + data.shortLink;
        } else {
          this.openManualCopy('短链地址（请手动复制）：', data.shortLink);
        }
      } catch (e) {
        this.actionError = '复制短链失败，请重试';
      }
    },

    // ---- 受保护文件夹 ----
    async loadProtection() {
      this.protError = '';
      this.protOk = '';
      this.protCorrupted = false;
      try {
        const res = await fetch('/api/auth/protection');
        if (res.status === 401) {
          this.goLogin('登录已失效，请重新登录');
          return;
        }
        const data = await this.readJson(res);
        if (!res.ok) {
          this.protError = '加载失败，请重试';
          return;
        }
        this.protList = data.protected || [];
        this.protSeq++;
        if (data.corrupted) this.protCorrupted = true;
      } catch (e) {
        this.protError = '加载失败，请重试';
      }
    },

    // 受保护列表的唯一写入口：PUT 后以服务端返回为准，失败时从服务端重载，
    // 列表永远只反映已落盘的状态，不存在“本地改了、服务端没存”的中间态。
    async putProtection(next) {
      const res = await fetch('/api/auth/protection', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ protected: next }),
      });
      if (res.status === 401) {
        this.goLogin('登录已失效，请重新登录');
        return null;
      }
      const data = await this.readJson(res);
      if (!res.ok) {
        return { error: data.error ? `保存失败：${data.error}` : '保存失败，请重试' };
      }
      return { protected: data.protected || next };
    },

    // 增加保护只接受选择器给的前缀（已是文件夹前缀、末尾带 /）；不再手输。
    async addProtection(picked) {
      if (this.protBusy) return;
      const prefix = picked || '';
      if (!prefix) {
        this.protError = '请先选择文件夹';
        return;
      }
      if (this.protList.includes(prefix)) {
        this.protError = '';
        this.protOk = '该文件夹已在受保护列表中，无需重复添加';
        return;
      }
      this.protError = '';
      this.protOk = '';
      this.protBusy = true;
      try {
        const result = await this.putProtection([...this.protList, prefix]);
        if (!result) return;
        if (result.error) {
          await this.loadProtection();
          this.protError = result.error;
          return;
        }
        this.protList = result.protected;
        this.protCorrupted = false;
        if (this.protList.includes(prefix)) {
          this.protOk = `已保存：${prefix} 已受保护`;
          this.protPick = '';
          this.loadProtFolders();
        } else {
          this.protError = '保存后服务端未包含该前缀，请检查格式';
        }
      } catch (e) {
        await this.loadProtection();
        this.protError = '保存失败，请重试';
      } finally {
        this.protBusy = false;
      }
    },

    // 受保护页的顶层文件夹：与文件页同源（GET /api/children/ 根目录），不新增接口。
    // 失败时不阻塞：已保护前缀仍进“其他”组继续用勾选管理。
    async loadProtFolders() {
      this.protFoldersLoading = true;
      this.protFoldersError = '';
      try {
        const res = await fetch('/api/children/');
        if (res.status === 401) {
          this.goLogin('登录已失效，请重新登录');
          return;
        }
        if (!res.ok) throw new Error('http_' + res.status);
        const data = await this.readJson(res);
        this.protTopFolders = this.withoutMarkerKeys(data.folders);
        this.resetProtTree();
      } catch (e) {
        this.protTopFolders = [];
        this.resetProtTree();
        this.protFoldersError = '文件夹列表加载失败，仍可管理已保护前缀';
      } finally {
        this.protFoldersLoading = false;
      }
    },

    // 树状态复位：根目录重载时可见行回到顶层，缓存与失败态一并清掉。
    resetProtTree() {
      this.protTreeRows = this.protTopFolders.map((f) => ({ kind: 'folder',
      prefix: f,
      depth: 0,
      key: f }));
      this.protTreeChildren = {};
      this.protTreeExpanded = {};
      this.protTreeLoading = {};
      this.protTreeFailed = [];
    },

    // 该前缀是否被某个祖先前缀覆盖（精确前缀本身不算，勾选态另由 isProtected 判定）。
    isCoveredByAncestor(prefix) {
      return this.protList.some((p) => p !== prefix && prefix.startsWith(p));
    },

    // 展开/折叠：子文件夹按需拉取并缓存；折叠收起全部后代行并把后代展开态复位，
    // 使再次展开时从缓存重建，不出现“展开符已开但子行缺失”的错位。
    async toggleTreeNode(row) {
      const prefix = row.prefix;
      if (this.protTreeLoading[prefix]) return;
      if (this.protTreeExpanded[prefix]) {
        const idx = this.protTreeRows.findIndex((r) => r.key === row.key);
        if (idx >= 0) {
          let end = idx + 1;
          while (end < this.protTreeRows.length
          && this.protTreeRows[end].depth > row.depth) {
            if (this.protTreeRows[end].kind === 'folder') this
            .protTreeExpanded[this.protTreeRows[end].prefix] = false;
            end++;
          }
          this.protTreeRows.splice(idx + 1, end - (idx + 1));
        }
        this.protTreeExpanded[prefix] = false;
        return;
      }
      const cached = this.protTreeChildren[prefix];
      if (cached) {
        this.protTreeExpanded[prefix] = true;
        this.insertTreeChildren(row, cached);
        return;
      }
      this.protTreeLoading[prefix] = true;
      this.protTreeFailed = this.protTreeFailed.filter((f) => f !== prefix);
      try {
        const res = await fetch(`/api/children/${prefix}`);
        if (res.status === 401) {
          this.goLogin('登录已失效，请重新登录');
          return;
        }
        if (!res.ok) throw new Error('http_' + res.status);
        const data = await this.readJson(res);
        const children = this.withoutMarkerKeys(data.folders);
        this.protTreeChildren[prefix] = children;
        this.protTreeExpanded[prefix] = true;
        this.insertTreeChildren(row, children);
      } catch (e) {
        if (!this.protTreeFailed.includes(prefix)) this
        .protTreeFailed
        .push(prefix);
      } finally {
        this.protTreeLoading[prefix] = false;
      }
    },

    insertTreeChildren(row, children) {
      const idx = this.protTreeRows.findIndex((r) => r.key === row.key);
      if (idx < 0) return;
      const rows = children.length
        ? children.map((c) => ({ kind: 'folder',
        prefix: c,
        depth: row.depth + 1,
        key: c }))
        : [{ kind: 'empty',
        parent: row.prefix,
        depth: row.depth + 1,
        key: 'empty:' + row.prefix }];
      this.protTreeRows.splice(idx + 1, 0, ...rows);
    },

    isProtected(prefix) {
      return this.protList.includes(prefix);
    },

    // 勾选即自动保存：与旧的增加/删除共用唯一写入口 putProtection，
    // 成功回显具体对象，失败时错误可见并从服务端重载回真相（勾选框随服务端状态复原）。
    async toggleProtection(prefix, on) {
      if (this.protBusy) return;
      const already = this.protList.includes(prefix);
      if (on === already) return;
      const next = on ? [...this.protList,
      prefix] : this.protList.filter((x) => x !== prefix);
      this.protError = '';
      this.protOk = '';
      this.protBusy = true;
      try {
        const result = await this.putProtection(next);
        if (!result) return;
        if (result.error) {
          await this.loadProtection();
          this.protError = result.error;
          return;
        }
        this.protList = result.protected;
        this.protCorrupted = false;
        if (on) {
          this.protOk = `已保存：${prefix} 已受保护`;
        } else if (this.isCoveredByAncestor(prefix)) {
          this.protOk = `已保存：已取消保护 ${prefix}（仍由父级覆盖）`;
        } else {
          this.protOk = `已保存：已取消保护 ${prefix}`;
        }
      } catch (e) {
        await this.loadProtection();
        this.protError = '保存失败，请重试';
      } finally {
        this.protBusy = false;
      }
    },

    // 仅配置损坏时出现：把当前列表原样写回服务端，覆盖损坏的配置。
    async repairProtection() {
      if (this.protBusy) return;
      this.protError = '';
      this.protOk = '';
      this.protBusy = true;
      try {
        const result = await this.putProtection(this.protList);
        if (!result) return;
        if (result.error) {
          await this.loadProtection();
          this.protError = result.error;
          return;
        }
        this.protList = result.protected;
        this.protCorrupted = false;
        this.protOk = '已用当前列表覆盖修复';
      } catch (e) {
        await this.loadProtection();
        this.protError = '保存失败，请重试';
      } finally {
        this.protBusy = false;
      }
    },

    // ---- 文件夹选择器（受保护增加、分享、规则、移动共用） ----
    openPicker(target) {
      this.pickerTarget = target;
      if (target !== 'move') this.pickerMoveKey = '';
      // 预选调用方当前值：分享/规则是表单值，移动是当前目录，新增保护无预选。
      if (target === 'share') this.pickerSelected = this.shareForm.prefix;
      else if (target === 'rule') this.pickerSelected = this.newRule.prefix;
      else if (target === 'move') this.pickerSelected = this.cwd;
      else this.pickerSelected = '';
      this.pickerOpen = true;
      this.loadPickerRoot();
    },

    closePicker() {
      this.pickerOpen = false;
      this.pickerTarget = '';
    },

    // 选择器根目录独立拉取（与受保护树互不干扰）：受保护树根加载失败时，
    // 选择器仍可自己重试，不依赖受保护页的状态。
    async loadPickerRoot() {
      this.pickerRootLoading = true;
      this.pickerRootError = '';
      try {
        const res = await fetch('/api/children/');
        if (res.status === 401) {
          this.closePicker();
          this.goLogin('登录已失效，请重新登录');
          return;
        }
        if (!res.ok) throw new Error('http_' + res.status);
        const data = await this.readJson(res);
        this.pickerTopFolders = data.folders || [];
        this.pickerRows = this.pickerTopFolders.map((f) => ({ kind: 'folder',
        prefix: f,
        depth: 0,
        key: f }));
        this.pickerChildren = {};
        this.pickerExpanded = {};
        this.pickerLoading = {};
        this.pickerFailed = [];
      } catch (e) {
        this.pickerTopFolders = [];
        this.pickerRows = [];
        this.pickerRootError = '文件夹列表加载失败，请重试';
      } finally {
        this.pickerRootLoading = false;
      }
    },

    // 与受保护树同一套懒加载套路：展开按需拉子文件夹并缓存；折叠收起全部
    // 后代行并把后代展开态复位，使再次展开时从缓存重建。
    async togglePickerNode(row) {
      const prefix = row.prefix;
      if (this.pickerLoading[prefix]) return;
      if (this.pickerExpanded[prefix]) {
        const idx = this.pickerRows.findIndex((r) => r.key === row.key);
        if (idx >= 0) {
          let end = idx + 1;
          while (end < this.pickerRows.length
          && this.pickerRows[end].depth > row.depth) {
            if (this.pickerRows[end].kind === 'folder') this
            .pickerExpanded[this.pickerRows[end].prefix] = false;
            end++;
          }
          this.pickerRows.splice(idx + 1, end - (idx + 1));
        }
        this.pickerExpanded[prefix] = false;
        return;
      }
      const cached = this.pickerChildren[prefix];
      if (cached) {
        this.pickerExpanded[prefix] = true;
        this.insertPickerChildren(row, cached);
        return;
      }
      this.pickerLoading[prefix] = true;
      this.pickerFailed = this.pickerFailed.filter((f) => f !== prefix);
      try {
        const res = await fetch(`/api/children/${prefix}`);
        if (res.status === 401) {
          this.closePicker();
          this.goLogin('登录已失效，请重新登录');
          return;
        }
        if (!res.ok) throw new Error('http_' + res.status);
        const data = await this.readJson(res);
        const children = this.withoutMarkerKeys(data.folders);
        this.pickerChildren[prefix] = children;
        this.pickerExpanded[prefix] = true;
        this.insertPickerChildren(row, children);
      } catch (e) {
        if (!this.pickerFailed.includes(prefix)) this.pickerFailed.push(prefix);
      } finally {
        this.pickerLoading[prefix] = false;
      }
    },

    insertPickerChildren(row, children) {
      const idx = this.pickerRows.findIndex((r) => r.key === row.key);
      if (idx < 0) return;
      const rows = children.length
        ? children.map((c) => ({ kind: 'folder',
        prefix: c,
        depth: row.depth + 1,
        key: c }))
        : [{ kind: 'empty',
        parent: row.prefix,
        depth: row.depth + 1,
        key: 'empty:' + row.prefix }];
      this.pickerRows.splice(idx + 1, 0, ...rows);
    },

    // 确认才写回：取消不改任何值。移动目标直接执行，其余三处只写回表单字段。
    async confirmPicker() {
      const target = this.pickerTarget;
      const selected = this.pickerSelected;
      this.closePicker();
      if (target === 'protection') {
        this.protPick = selected;
      } else if (target === 'share') {
        this.shareForm.prefix = selected;
      } else if (target === 'rule') {
        this.newRule.prefix = selected;
      } else if (target === 'move') {
        await this.confirmMove();
      }
    },

    async confirmMove() {
      const key = this.pickerMoveKey;
      if (!key) return;
      const target = (this.pickerSelected || '') + key.split('/').pop();
      if (await this.adminFileAction({ action: 'move', key, target })) {
        this.actionOk = '已移动';
        this.fetchFilesAdmin();
      }
    },

    // ---- WebDAV ----
    async loadDav() {
      this.davError = '';
      this.davOk = '';
      try {
        const res = await fetch('/api/admin/dav-settings');
        if (res.status === 401) {
          this.goLogin('登录已失效，请重新登录');
          return;
        }
        const data = await this.readJson(res);
        if (!res.ok) {
          this.davError = '加载失败，请重试';
          return;
        }
        this.davEnabled = !!data.enabled;
      } catch (e) {
        this.davError = '加载失败，请重试';
      }
    },

    async saveDav() {
      this.davSwitchBusy = true;
      this.davError = '';
      this.davOk = '';
      try {
        const res = await fetch('/api/admin/dav-settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enabled: !!this.davEnabled }),
        });
        if (res.status === 401) {
          this.goLogin('登录已失效，请重新登录');
          return;
        }
        const data = await this.readJson(res);
        if (!res.ok) {
          this.davError = data.error ? `保存失败：${data.error}` : '保存失败，请重试';
          return;
        }
        this.davEnabled = !!data.enabled;
        this.davOk = this.davEnabled ? 'WebDAV 已开启' : 'WebDAV 已关闭，DAV 接口会拒绝请求';
      } catch (e) {
        this.davError = '保存失败，请重试';
      } finally {
        this.davSwitchBusy = false;
      }
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

    async copyDavAddr() {
      this.davCopyOk = '';
      if (await copyTextToClipboard(this.davAddr)) {
        this.davCopyOk = '已复制';
      } else {
        this.openManualCopy('WebDAV 地址（请手动复制）：', this.davAddr);
      }
    },

    // ---- 短链 ----
    async loadShorten() {
      this.shortenError = '';
      this.shortenOk = '';
      try {
        const res = await fetch('/api/admin/shorten-settings');
        if (res.status === 401) {
          this.goLogin('登录已失效，请重新登录');
          return;
        }
        const data = await this.readJson(res);
        if (!res.ok) {
          this.shortenError = '加载失败，请重试';
          return;
        }
        this.shortenEnabled = data.enabled !== false;
        this.shortenBaseUrl = data.baseUrl || '';
        this.shortenHasToken = !!data.hasToken;
        this.shortenConfigured = !!data.configured;
        this.shortenSource = data.source || 'none';
        this.shortenCorrupted = !!data.corrupted;
        this.shortenToken = '';
      } catch (e) {
        this.shortenError = '加载失败，请重试';
      }
    },

    // 只保存总开关：不碰服务地址与 Token 输入框（勾选即立即生效）。
    async saveShortenEnabled() {
      if (this.shortenSwitchBusy) return;
      this.shortenSwitchBusy = true;
      this.shortenError = '';
      this.shortenOk = '';
      try {
        const res = await fetch('/api/admin/shorten-settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enabled: this.shortenEnabled }),
        });
        if (res.status === 401) {
          this.goLogin('登录已失效，请重新登录');
          return;
        }
        const data = await this.readJson(res);
        if (!res.ok) {
          this.shortenError = data.error ? `保存失败：${data.error}` : '保存失败，请重试';
          return;
        }
        this.shortenEnabled = data.enabled !== false;
        this.shortenOk = this.shortenEnabled ? '短链功能已开启' : '短链功能已关闭，全部短链入口已隐藏';
      } catch (e) {
        this.shortenError = '保存失败，请重试';
      }
    },

    async saveShorten() {
      this.shortenError = '';
      this.shortenOk = '';
      try {
        const res = await fetch('/api/admin/shorten-settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ baseUrl: (this.shortenBaseUrl || '').trim(),
          token: this.shortenToken || '',
            enabled: this.shortenEnabled }),
        });
        if (res.status === 401) {
          this.goLogin('登录已失效，请重新登录');
          return;
        }
        const data = await this.readJson(res);
        if (!res.ok) {
          this.shortenError = data.error ? `保存失败：${data.error}` : '保存失败，请重试';
          return;
        }
        this.shortenEnabled = data.enabled !== false;
        this.shortenBaseUrl = data.baseUrl || '';
        this.shortenHasToken = !!data.hasToken;
        this.shortenConfigured = !!data.configured;
        this.shortenSource = data.source || 'none';
        this.shortenCorrupted = !!data.corrupted;
        this.shortenToken = '';
        if (data.configured) {
          this.shortenOk = '已保存，后台配置已生效';
        } else if (data.source === 'env') {
          this.shortenOk = '已保存，后台未配齐，当前仍沿用环境变量';
        } else {
          this.shortenOk = '已保存，但后台未配齐且无环境变量，短链仍未配置';
        }
      } catch (e) {
        this.shortenError = '保存失败，请重试';
      } finally {
        this.shortenSwitchBusy = false;
      }
    },

    // ---- 上传限制 ----
    async loadLimits() {
      this.limitError = '';
      this.limitOk = '';
      try {
        const res = await fetch('/api/admin/upload-limits');
        if (res.status === 401) {
          this.goLogin('登录已失效，请重新登录');
          return;
        }
        const data = await this.readJson(res);
        if (!res.ok) {
          this.limitError = '加载失败，请重试';
          return;
        }
        this.limitMaxFile = data.max_file_mb;
        this.limitDaily = data.daily_mb;
        this.limitTotal = data.total_mb;
        this.limitExpiry = data.expiry_hours;
      } catch (e) {
        this.limitError = '加载失败，请重试';
      }
    },

    async saveLimits() {
      this.limitError = '';
      this.limitOk = '';
      try {
        const res = await fetch('/api/admin/upload-limits', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            max_file_mb: this.limitMaxFile,
            daily_mb: this.limitDaily,
            total_mb: this.limitTotal,
            expiry_hours: this.limitExpiry,
          }),
        });
        if (res.status === 401) {
          this.goLogin('登录已失效，请重新登录');
          return;
        }
        const data = await this.readJson(res);
        if (!res.ok) {
          this.limitError = data.error ? `保存失败：${data.error}` : '保存失败，请重试';
          return;
        }
        this.limitMaxFile = data.max_file_mb;
        this.limitDaily = data.daily_mb;
        this.limitTotal = data.total_mb;
        this.limitExpiry = data.expiry_hours;
        this.limitOk = '已保存，上传限制已生效';
      } catch (e) {
        this.limitError = '保存失败，请重试';
      }
    },

    // ---- 分享 ----
    shareFolder(prefix) {
      this.shareForm.prefix = prefix;
      this.shareResult = null;
      this.shareOk = '';
      this.switchTab('shares');
    },

    shareLinkOf(s) {
      return window.location.origin + '/s/' + s.slug;
    },

    shareExpiryText(s) {
      if (!s.expiresAt) return '永久有效';
      return '有效期至 ' + new Date(s.expiresAt * 1000).toLocaleString();
    },

    async loadShares() {
      this.shareError = '';
      try {
        const res = await fetch('/api/admin/shares');
        if (res.status === 401) {
          this.goLogin('登录已失效，请重新登录');
          return;
        }
        const data = await this.readJson(res);
        if (!res.ok) {
          this.shareError = '加载失败，请重试';
          return;
        }
        this.shares = data.shares || [];
      } catch (e) {
        this.shareError = '加载失败，请重试';
      }
    },

    async createShare() {
      this.shareError = '';
      this.shareOk = '';
      this.shareResult = null;
      if (!this.shareForm.prefix) {
        this.shareError = '请先选择文件夹';
        return;
      }
      this.shareBusy = true;
      try {
        const res = await fetch('/api/admin/shares', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prefix: this.shareForm.prefix,
            code: this.shareForm.code,
            expiresIn: this.shareForm.expiresIn,
          }),
        });
        const data = await this.readJson(res);
        if (res.status === 401) {
          this.goLogin('登录已失效，请重新登录');
          return;
        }
        if (!res.ok) {
          if (data.error === 'not_protected') this
          .shareError = '该文件夹当前不受保护，请先在受保护页勾选';
          else if (data.error === 'invalid_code') this
          .shareError = '提取码须为 4-8 位字母数字';
          else if (data.error === 'invalid_prefix') this.shareError = '文件夹前缀无效';
          else if (data.error === 'invalid_expires') this.shareError = '有效期无效';
          else this.shareError = '生成失败，请重试';
          return;
        }
        this.shareResult = data;
        this.shareForm.code = '';
        this.shareOk = '分享已生成，请立即复制提取码';
        await this.loadShares();
      } catch (e) {
        this.shareError = '生成失败，请重试';
      } finally {
        this.shareBusy = false;
      }
    },

    async deleteShare(s) {
      if (!confirm('撤销后该分享链接与提取码立即失效，确定撤销？')) return;
      this.shareError = '';
      this.shareOk = '';
      this.shareWarn = '';
      try {
        const res = await fetch(`/api/admin/shares/${encodeURIComponent(s.slug)}`, {
          method: 'DELETE',
        });
        if (res.status === 401) {
          this.goLogin('登录已失效，请重新登录');
          return;
        }
        if (!res.ok) {
          this.shareError = '撤销失败，请重试';
          return;
        }
        const data = await res.json().catch(() => ({}));
        this.shareOk = '已撤销';
        // 撤销本身已成功；短链同步删除失败只作提醒，不改撤销结果。
        const failures = Array
        .isArray(data.sinkFailures) ? data
        .sinkFailures : [];
        if (failures.length) {
          const codes = failures.map((f) => f.shortCode).filter(Boolean);
          this.shareWarn = codes.length
            ? `以下短链未能同步删除，请去 Sink 后台手动删除：${codes.join('、')}`
            : '短链同步删除失败，请去 Sink 后台核对';
        }
        await this.loadShares();
      } catch (e) {
        this.shareError = '撤销失败，请重试';
      }
    },

    async regenerateShare(s) {
      this.shareError = '';
      this.shareOk = '';
      this.shareResult = null;
      try {
        const res = await fetch(`/api/admin/shares/${encodeURIComponent(s.slug)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'regenerate' }),
        });
        const data = await this.readJson(res);
        if (res.status === 401) {
          this.goLogin('登录已失效，请重新登录');
          return;
        }
        if (!res.ok) {
          this.shareError = '重新生成失败，请重试';
          return;
        }
        this.shareResult = data;
        this.shareOk = '新提取码已生成，旧码已失效，请立即复制';
        await this.loadShares();
      } catch (e) {
        this.shareError = '重新生成失败，请重试';
      }
    },

    // ---- 分享链接管理 ----
    // 状态判定（前端按行字段算）：已过期是终态，优先于已锁定。
    shareStatus(s) {
      const now = Math.floor(Date.now() / 1000);
      if (s.expiresAt && s.expiresAt <= now) return 'expired';
      if (s.lockedUntil && s.lockedUntil > now) return 'locked';
      if (!s.enabled) return 'disabled';
      return 'active';
    },

    shareStatusText(s) {
      const texts = {
        active: '正常',
        expired: '已过期',
        locked: '已锁定',
        disabled: '已停用',
      };
      return texts[this.shareStatus(s)] || '正常';
    },

    shareShortlinkTypeText(r) {
      if (r.targetKind === 'with_code') return '带码短链';
      if (r.targetKind === 'plain') return '普通短链';
      return '未知类型';
    },

    shortlinkTimeText(r) {
      if (!r.createdAt) return '';
      return new Date(r.createdAt * 1000).toLocaleString();
    },

    shareShortlinksRows(s) {
      return this.shareShortlinks[s.slug] || [];
    },

    async toggleShareDetail(s) {
      const on = !this.shareExpanded[s.slug];
      this.shareExpanded = Object.assign({}, this.shareExpanded,
        { [s.slug]: on });
      if (on && !this.shareShortlinks[s.slug] && this.shortenEnabled) {
        await this.loadShareShortlinks(s);
      }
    },

    async loadShareShortlinks(s) {
      this.shareShortlinksLoading = Object.assign(
        {}, this.shareShortlinksLoading, { [s.slug]: true });
      this.shareShortlinksError = Object.assign(
        {}, this.shareShortlinksError, { [s.slug]: '' });
      try {
        const res = await fetch(
          `/api/admin/shares/${encodeURIComponent(s.slug)}/shortlinks`);
        if (res.status === 401) {
          this.goLogin('登录已失效，请重新登录');
          return;
        }
        const data = await this.readJson(res);
        if (!res.ok) {
          this.shareShortlinksError = Object.assign(
            {}, this.shareShortlinksError, { [s.slug]: '短链加载失败，请重试' });
          return;
        }
        this.shareShortlinks = Object.assign({}, this.shareShortlinks,
          { [s.slug]: data.shortlinks || [] });
      } catch (e) {
        this.shareShortlinksError = Object.assign(
          {}, this.shareShortlinksError, { [s.slug]: '短链加载失败，请重试' });
      } finally {
        this.shareShortlinksLoading = Object.assign(
          {}, this.shareShortlinksLoading, { [s.slug]: false });
      }
    },

    async setShareEnabled(s, enabled) {
      if (!enabled && !confirm(
        '停用后该分享链接与提取码立即失效，短链跳转后同样无法访问，确定停用？')) return;
      this.shareError = '';
      this.shareOk = '';
      try {
        const res = await fetch(
          `/api/admin/shares/${encodeURIComponent(s.slug)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: enabled ? 'enable' : 'disable' }),
          });
        if (res.status === 401) {
          this.goLogin('登录已失效，请重新登录');
          return;
        }
        const data = await this.readJson(res);
        if (!res.ok) {
          this.shareError = enabled ? '启用失败，请重试' : '停用失败，请重试';
          return;
        }
        s.enabled = data.enabled !== false;
        this.shareOk = enabled ? '已启用' : '已停用';
      } catch (e) {
        this.shareError = enabled ? '启用失败，请重试' : '停用失败，请重试';
      }
    },

    // 重新生成并直接复制带码链接：与“重新生成提取码”同一接口，
    // 只是成功后把带码链接写进剪贴板（结果框仍展示新码备查）。
    async regenerateAndCopyCodeLink(s) {
      this.shareError = '';
      this.shareOk = '';
      this.shareResult = null;
      try {
        const res = await fetch(
          `/api/admin/shares/${encodeURIComponent(s.slug)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'regenerate' }),
          });
        const data = await this.readJson(res);
        if (res.status === 401) {
          this.goLogin('登录已失效，请重新登录');
          return;
        }
        if (!res.ok) {
          this.shareError = '重新生成失败，请重试';
          return;
        }
        this.shareResult = data;
        this.shareOk = '新提取码已生成，旧码已失效，请立即复制';
        const link = window.location.origin + data.shareUrl
          + '?code=' + encodeURIComponent(data.code);
        if (await copyTextToClipboard(link)) {
          this.shareOk = '带提取码的链接已复制，新码见上方结果框';
        } else {
          this.openManualCopy('带提取码的链接（请手动复制）：', link);
        }
        await this.loadShares();
      } catch (e) {
        this.shareError = '重新生成失败，请重试';
      }
    },

    async createPlainShortlink(s) {
      await this.copyShareShortLink(s);
      if (this.shareExpanded[s.slug]) await this.loadShareShortlinks(s);
    },

    async copyShortlinkRow(r) {
      if (!r.shortLink) return;
      if (await copyTextToClipboard(r.shortLink)) {
        this.shareOk = '短链已复制：' + r.shortLink;
      } else {
        this.openManualCopy('短链地址（请手动复制）：', r.shortLink);
      }
    },

    async deleteShortlinkRow(s, r) {
      if (!confirm(
        '删除后该短链立即失效，Sink 没有回收站，无法恢复；分享本身不受影响，确定删除？')) return;
      this.shareError = '';
      this.shareOk = '';
      this.shareWarn = '';
      try {
        const res = await fetch(
          `/api/admin/shares/${encodeURIComponent(s.slug)}/shortlinks/${encodeURIComponent(r.shortCode)}`, {
            method: 'DELETE',
          });
        if (res.status === 401) {
          this.goLogin('登录已失效，请重新登录');
          return;
        }
        const data = await this.readJson(res);
        if (!res.ok) {
          const failures = Array.isArray(data.sinkFailures)
            ? data.sinkFailures : [];
          if (failures.length) {
            this.shareWarn = '短链删除失败，请去 Sink 后台手动删除：'
              + failures.map((f) => f.shortCode).filter(Boolean).join('、');
          } else {
            this.shareError = '删除短链失败，请重试';
          }
          return;
        }
        this.shareOk = '短链已删除';
        await this.loadShareShortlinks(s);
        await this.loadShares();
      } catch (e) {
        this.shareError = '删除短链失败，请重试';
      }
    },

    async purgeExpiredShares() {
      if (!confirm(
        '将删除全部已过期分享及其已记录短链，此操作不可恢复，确定清理？')) return;
      this.shareError = '';
      this.shareOk = '';
      this.shareWarn = '';
      try {
        const res = await fetch('/api/admin/shares', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'purge_expired' }),
        });
        if (res.status === 401) {
          this.goLogin('登录已失效，请重新登录');
          return;
        }
        const data = await this.readJson(res);
        if (!res.ok) {
          this.shareError = '清理失败，请重试';
          return;
        }
        this.shareOk = `已清理 ${data.purgedCount || 0} 条过期分享`;
        const failures = Array.isArray(data.sinkFailures)
          ? data.sinkFailures : [];
        if (failures.length) {
          const codes = failures.map((f) => f.shortCode).filter(Boolean);
          this.shareWarn = codes.length
            ? `以下短链未能同步删除，请去 Sink 后台手动删除：${codes.join('、')}`
            : '短链同步删除失败，请去 Sink 后台核对';
        }
        await this.loadShares();
      } catch (e) {
        this.shareError = '清理失败，请重试';
      }
    },

    clearShareFilters() {
      this.shareFilterPrefix = 'all';
      this.shareFilterStatus = 'all';
    },

    async copyShareLink(s) {
      if (await copyTextToClipboard(this.shareLinkOf(s))) {
        this.shareOk = '链接已复制';
      } else {
        this.openManualCopy('链接地址（请手动复制）：', this.shareLinkOf(s));
      }
    },

    async copyShareShortLink(s) {
      if (!this.shortenEnabled) return;
      this.shareError = '';
      try {
        const res = await fetch('/api/shorten', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ target: '/s/' + s.slug }),
        });
        const data = await this.readJson(res);
        if (res.status === 401) {
          this.goLogin('登录已失效，请重新登录');
          return;
        }
        if (!res.ok || !data.shortLink) {
          this.shareError = data.error === 'shorten_not_configured'
            ? '短链未配置，请先在短链页签配置 Sink'
            : (data.error ? `复制短链失败：${data.error}` : '复制短链失败，请重试');
          return;
        }
        if (await copyTextToClipboard(data.shortLink)) {
          this.shareOk = '短链已复制：' + data.shortLink;
        } else {
          this.openManualCopy('短链地址（请手动复制）：', data.shortLink);
        }
        // 短链已生成并记入映射；详情区若正展开，刷新短链列表。
        if (this.shareExpanded[s.slug]) await this.loadShareShortlinks(s);
      } catch (e) {
        this.shareError = '复制短链失败，请重试';
      }
    },

    async copyShareResult() {
      if (!this.shareResult) return;
      const text = `链接：${this.shareResultLink}\n提取码：${this.shareResult.code}`;
      if (await copyTextToClipboard(text)) {
        this.shareOk = '链接与提取码已复制';
      } else {
        this.openManualCopy('链接与提取码（请手动复制）：', text);
      }
    },

    // 带提取码的链接：origin + /s/<slug> + ?code=<code>，访客打开即自动验码。
    // 只在生成/重新生成结果框里出现（提取码只显示一次，列表里拿不回原文）。
    async copyShareCodeLink() {
      if (!this.shareResult) return;
      const link = this
      .shareResultLink + '?code=' + encodeURIComponent(this.shareResult.code);
      if (await copyTextToClipboard(link)) {
        this.shareOk = '带提取码的链接已复制';
      } else {
        this.openManualCopy('带提取码的链接（请手动复制）：', link);
      }
    },

    // 带提取码的短链：把带码链接交给 /api/shorten，短链跳转后访客仍落
    // 在带码链接上、自动验码一次。同样只在结果框里出现（列表行没有
    // 提取码原文，做不出带码短链）。
    async copyShareCodeShortLink() {
      if (!this.shareResult) return;
      this.shareError = '';
      try {
        const res = await fetch('/api/shorten', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            target: this.shareResult.shareUrl + '?code='
              + encodeURIComponent(this.shareResult.code),
          }),
        });
        if (res.status === 401) {
          this.goLogin('登录已失效，请重新登录');
          return;
        }
        const data = await this.readJson(res);
        if (!res.ok || !data.shortLink) {
          this.shareError = data.error === 'shorten_not_configured'
            ? '短链未配置，请先在短链页签配置 Sink'
            : (data.error ? `复制失败：${data.error}` : '复制失败，请重试');
          return;
        }
        if (await copyTextToClipboard(data.shortLink)) {
          this.shareOk = '带提取码的短链已复制：' + data.shortLink;
        } else {
          this.openManualCopy('带提取码的短链（请手动复制）：', data.shortLink);
        }
      } catch (e) {
        this.shareError = '复制失败，请重试';
      }
    },

    // ---- 账号 ----
    async loadAccounts() {
      this.acctError = '';
      this.acctOk = '';
      try {
        const res = await fetch('/api/admin/accounts');
        if (res.status === 401) {
          this.goLogin('登录已失效，请重新登录');
          return;
        }
        const data = await this.readJson(res);
        if (!res.ok) {
          this.acctError = '加载失败，请重试';
          return;
        }
        this.users = (data.users || []).map((u) => ({
          user: u.user,
          role: u.role || 'user',
          enabled: u.enabled !== false,
          davEnabled: !!u.davEnabled,
          _newPass: '',
        }));
      } catch (e) {
        this.acctError = '加载失败，请重试';
      }
    },

    async createUser() {
      this.acctError = '';
      this.acctOk = '';
      if (!this.newAcct.user || !this.newAcct.password) {
        this.acctError = '请填写账号和密码';
        return;
      }
      try {
        const res = await fetch('/api/admin/accounts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user: this.newAcct.user,
            password: this.newAcct.password,
            role: this.newAcct.role,
            davEnabled: !!this.newAcct.davEnabled,
          }),
        });
        if (res.status === 401) {
          this.goLogin('登录已失效，请重新登录');
          return;
        }
        const data = await this.readJson(res);
        if (!res.ok) {
          this.acctError = data.error ? `新建失败：${data.error}` : '新建失败，请重试';
          return;
        }
        this.acctOk = '账号已创建';
        this.newAcct = { user: '',
        password: '',
        role: 'user',
        davEnabled: false };
        this.loadAccounts();
      } catch (e) {
        this.acctError = '新建失败，请重试';
      }
    },

    async saveUser(u) {
      this.acctError = '';
      this.acctOk = '';
      const body = { role: u.role,
      enabled: !!u.enabled,
      davEnabled: !!u.davEnabled };
      if (u._newPass) body.password = u._newPass;
      try {
        const res = await fetch('/api/admin/accounts/'
          + encodeURIComponent(u.user),
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (res.status === 401) {
          this.goLogin('登录已失效，请重新登录');
          return;
        }
        const data = await this.readJson(res);
        if (!res.ok) {
          this.acctError = data.error ? `保存失败：${data.error}` : '保存失败，请重试';
          return;
        }
        u._newPass = '';
        this.acctOk = '已保存';
      } catch (e) {
        this.acctError = '保存失败，请重试';
      }
    },

    // 修改当前登录账号的口令。账号已在库里时直接 PUT 改密；部署口令
    // 账号（不在库里）首次设置时在库里为其建 admin 行，此后该账号的
    // 登录口令以库里为准（账号库行存在时优先于部署口令，见 read-auth）。
    // 列表过期导致首选路径走错时，按 404/409 各重试一次另一路径。
    async changeMyPassword() {
      this.acctError = '';
      this.acctOk = '';
      if (!this.user) {
        this.acctError = '请先登录';
        return;
      }
      if (!this.myNewPass || this.myNewPass.length > 256) {
        this.acctError = '请填写新密码（不超过 256 字符）';
        return;
      }
      if (this.myNewPass !== this.myNewPass2) {
        this.acctError = '两次输入的新密码不一致';
        return;
      }
      const base = '/api/admin/accounts';
      const attempt = (method, body) => fetch(
        method === 'POST'
          ? base
          : base + '/' + encodeURIComponent(this.user),
        {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      const putBody = { password: this.myNewPass };
      const postBody = {
        user: this.user,
        password: this.myNewPass,
        role: 'admin',
        davEnabled: false,
      };
      try {
        const inLibrary = this.users.some((u) => u.user === this.user);
        let res = inLibrary
          ? await attempt('PUT', putBody)
          : await attempt('POST', postBody);
        let data = await this.readJson(res);
        if (!res.ok
          && ((res.status === 404 && inLibrary)
            || (res.status === 409 && !inLibrary))) {
          res = inLibrary
            ? await attempt('POST', postBody)
            : await attempt('PUT', putBody);
          data = await this.readJson(res);
        }
        if (res.status === 401) {
          this.goLogin('登录已失效，请重新登录');
          return;
        }
        if (!res.ok) {
          this.acctError = data.error ? `保存失败：${data.error}` : '保存失败，请重试';
          return;
        }
        this.myNewPass = '';
        this.myNewPass2 = '';
        // loadAccounts 会先清掉 acctOk，故成功文案必须在它完成后再写，
        // 否则刚显示就被清掉（删账号旧代码同病，已一并改顺）。
        await this.loadAccounts();
        if (!this.acctError) {
          this.acctOk = inLibrary
            ? '我的密码已修改，下次登录请用新密码'
            : '我的密码已修改（已在账号库中建立该账号，此后登录口令以库里为准），下次登录请用新密码';
        }
      } catch (e) {
        this.acctError = '保存失败，请重试';
      }
    },

    async deleteUser(username) {
      if (!window.confirm(`确定要删除账号 ${username} 吗？`)) return;
      try {
        const res = await fetch('/api/admin/accounts/'
          + encodeURIComponent(username),
        { method: 'DELETE' });
        if (res.status === 401) {
          this.goLogin('登录已失效，请重新登录');
          return;
        }
        if (!res.ok) {
          const data = await this.readJson(res);
          this.acctError = data.error ? `删除失败：${data.error}` : '删除失败，请重试';
          return;
        }
        await this.loadAccounts();
        if (!this.acctError) this.acctOk = '账号已删除';
      } catch (e) {
        this.acctError = '删除失败，请重试';
      }
    },

    // ---- 权限 ----
    async loadPermissions() {
      this.permError = '';
      this.permOk = '';
      try {
        const res = await fetch('/api/admin/permissions');
        if (res.status === 401) {
          this.goLogin('登录已失效，请重新登录');
          return;
        }
        const data = await this.readJson(res);
        if (!res.ok) {
          this.permError = '加载失败，请重试';
          return;
        }
        this.rules = data.rules || [];
      } catch (e) {
        this.permError = '加载失败，请重试';
      }
    },

    async createRule() {
      this.permError = '';
      this.permOk = '';
      if (!this.newRule.user || !this.newRule.prefix) {
        this.permError = '请选择账号和文件夹';
        return;
      }
      try {
        const res = await fetch('/api/admin/permissions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user: this.newRule.user,
            prefix: this.newRule.prefix,
            access: this.newRule.access,
          }),
        });
        if (res.status === 401) {
          this.goLogin('登录已失效，请重新登录');
          return;
        }
        const data = await this.readJson(res);
        if (!res.ok) {
          this.permError = data.error ? `新增失败：${data.error}` : '新增失败，请重试';
          return;
        }
        this.permOk = '规则已新增';
        this.newRule = { user: '', prefix: '', access: 'read' };
        this.loadPermissions();
      } catch (e) {
        this.permError = '新增失败，请重试';
      }
    },

    async deleteRule(r) {
      try {
        const res = await fetch('/api/admin/permissions', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user: r.user, prefix: r.prefix }),
        });
        if (res.status === 401) {
          this.goLogin('登录已失效，请重新登录');
          return;
        }
        if (!res.ok) {
          const data = await this.readJson(res);
          this.permError = data.error ? `删除失败：${data.error}` : '删除失败，请重试';
          return;
        }
        this.permOk = '规则已删除';
        this.loadPermissions();
      } catch (e) {
        this.permError = '删除失败，请重试';
      }
    },
  },

  created() {
    this.checkStatus();
    // 短链总开关（公开配置；取不到时默认开启，与旧行为一致）。
    fetch('/api/site-config')
      .then((res) => res.json())
      .then((data) => {
        if (data && typeof data.shortlink_enabled === 'boolean') {
          this.shortenEnabled = data.shortlink_enabled;
        }
        if (data && (data.skin === 'starship'
            || data.skin === 'original')) {
          this.skinLocal = data.skin;
          this.applySkin(data.skin);
        }
      })
      .catch(() => {});
    // 跨页签联动：另一页换肤写 localStorage 后，本页收到 storage 事件
    // 即时跟换，不刷新。
    this._onSkinStorage = (e) => {
      if (e.key === 'pan-skin' && (e.newValue === 'starship'
          || e.newValue === 'original')) {
        this.skinLocal = e.newValue;
        this.applySkin(e.newValue);
      }
    };
    window.addEventListener('storage', this._onSkinStorage);
  },
};
</script>

<style>
/* 管理后台样式：与公开站同一套设计语言 ——
   字体 寒蝉半圆体、主色 teal rgb(57,144,155)、半透明白面板 + 模糊、
   圆角 10/12/16、主按钮 50px pill + 阴影、whitesmoke 次级面。
   公开站实际呈现为浅色，后台同样用浅色，不另起深色主题。 */
.admin-page {
  min-height: 100%;
  padding: 24px 16px 60px;
  font-family: "寒蝉半圆体", -apple-system, BlinkMacSystemFont, "Segoe UI Adjusted",
    "Segoe UI", "Liberation Sans", sans-serif;
  background-image: url("/assets/bg-light.webp");
  background-size: cover;
  background-position: center;
  color: #2c2c2c;
}
/* 表单控件默认不继承字体（浏览器 UA 样式会盖掉），这里显式继承，
   否则管理后台所有输入框/下拉框都会是系统字体、与前端正文两样。
   这是上一轮“字体已一致”判断的漏点：正文有 main.css 的直接规则，
   但 input/select 不在 main.css 的字体规则里。 */
.admin-page input,
.admin-page select,
.admin-page textarea,
.admin-page button {
  font-family: inherit;
}
.admin-page button {
  font-size: 15px;
  padding: 8px 14px;
  border: none;
  border-radius: 10px;
  background: rgb(245, 245, 245);
  transition: background-color 0.2s ease-in-out;
}
.admin-page button:hover:not(:disabled) {
  background: rgb(212, 212, 212);
}
.admin-page button:disabled {
  opacity: 0.55;
  cursor: default;
}
.admin-page input[type="text"],
.admin-page input[type="password"],
.admin-page input[type="number"],
.admin-page input:not([type]) {
  background-color: whitesmoke;
  border: none;
  border-radius: 16px;
  padding: 10px 14px;
  box-sizing: border-box;
  font-size: 15px;
}
/* 上传限制卡片：数字输入框与其它输入框同款圆角底，单位后缀与提示
   分行排布，不再是裸 label + 裸 number 输入框。 */
.admin-limit-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin: 12px 0;
}
.admin-limit-card {
  background: rgba(255, 255, 255, 0.65);
  backdrop-filter: blur(10px);
  border-radius: 12px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  padding: 16px;
}
.admin-limit-label {
  font-size: 15px;
  margin-bottom: 8px;
}
.admin-limit-field {
  display: flex;
  align-items: center;
  gap: 8px;
}
.admin-limit-field input {
  flex: 1;
  min-width: 0;
}
/* 数字输入框去掉浏览器默认上下箭头，改走键盘输入，与其它输入框一样干净 */
.admin-limit-field input::-webkit-outer-spin-button,
.admin-limit-field input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
.admin-limit-field input[type="number"] {
  -moz-appearance: textfield;
  appearance: textfield;
}
.admin-limit-unit {
  font-size: 14px;
  color: dimgray;
  flex-shrink: 0;
}
.admin-limit-hint {
  font-size: 13px;
  color: dimgray;
  margin-top: 6px;
}
.admin-page select {
  background-color: whitesmoke;
  border: none;
  border-radius: 16px;
  padding: 10px 12px;
  font-size: 15px;
}
.admin-page code {
  background-color: whitesmoke;
  padding: 2px 8px;
  border-radius: 8px;
}
.admin-login {
  max-width: 420px;
  margin: 80px auto 0;
  background: rgba(255, 255, 255, 0.65);
  backdrop-filter: blur(10px);
  border-radius: 12px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  padding: 28px 24px;
}
.admin-login h1,
.admin-bar h1 {
  font-size: 20px;
  margin: 0;
}
.admin-sub {
  color: dimgray;
  font-size: 14px;
  line-height: 1.6;
}
.admin-form label {
  display: block;
  margin-bottom: 12px;
  font-size: 14px;
}
.admin-form input {
  display: block;
  width: 100%;
  margin-top: 4px;
}
.admin-form .admin-btn-primary {
  width: 100%;
  margin-top: 4px;
}
.admin-page .admin-btn-primary {
  padding: 10px 24px;
  background: rgb(57, 144, 155);
  color: #fff;
  border: 0;
  border-radius: 50px;
  cursor: pointer;
  box-shadow: 2px 4px 6px rgba(0, 0, 0, 0.3);
  font-size: 15px;
}
.admin-page .admin-btn-primary:hover:not(:disabled) {
  background: rgb(45, 115, 124);
}
.admin-page .admin-btn-primary:disabled {
  box-shadow: none;
}
.admin-page .admin-btn {
  padding: 8px 16px;
  cursor: pointer;
  background: rgb(245, 245, 245);
  border-radius: 10px;
}
.admin-console {
  max-width: 1100px;
  margin: 0 auto;
  background: rgba(255, 255, 255, 0.65);
  backdrop-filter: blur(10px);
  border-radius: 12px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  padding: 24px;
}
.admin-bar {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}
.admin-who {
  margin-left: auto;
  background: whitesmoke;
  border-radius: 50px;
  padding: 6px 14px;
  font-size: 13px;
  color: dimgray;
}
/* 侧栏布局：左导航 + 右内容。 */
.admin-layout {
  display: flex;
  gap: 24px;
  margin-top: 16px;
  align-items: flex-start;
}
.admin-sidebar {
  flex: 0 0 200px;
  position: sticky;
  top: 16px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.admin-nav-group {
  margin-top: 14px;
}
.admin-nav-group-title {
  font-size: 12px;
  color: #8b949e;
  letter-spacing: 0.08em;
  padding: 0 12px 6px;
}
.admin-page .admin-nav-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  text-align: left;
  padding: 9px 12px;
  border-radius: 10px;
  background: transparent;
  color: #24292f;
  font-size: 14px;
}
.admin-page .admin-nav-item:hover:not(.on) {
  background: rgba(0, 0, 0, 0.05);
}
.admin-page .admin-nav-item.on {
  background: rgb(57, 144, 155);
  color: #fff;
  font-weight: bold;
  box-shadow: 2px 4px 6px rgba(0, 0, 0, 0.3);
}
.admin-nav-label {
  flex: 1;
  min-width: 0;
}
.admin-nav-badge {
  flex: none;
  min-width: 20px;
  text-align: center;
  font-size: 12px;
  line-height: 1.6;
  padding: 0 6px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.08);
  color: #57606a;
}
.admin-nav-item.on .admin-nav-badge {
  background: rgba(255, 255, 255, 0.25);
  color: #fff;
}
/* 侧栏底部状态行：绿点自身闪烁（只有小点本身的透明度明暗，无扩散环）。 */
.admin-nav-status {
  margin-top: 18px;
  padding: 12px 12px 4px;
  border-top: 1px solid rgba(0, 0, 0, 0.08);
  font-size: 13px;
  color: #656d76;
  display: flex;
  align-items: center;
  gap: 8px;
}
.admin-status-dot {
  flex: none;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #8b949e;
}
.admin-status-dot.ok {
  background: #3fb950;
  animation: admin-dot-blink 1.6s ease-in-out infinite;
}
.admin-status-dot.bad {
  background: #f85149;
}
@keyframes admin-dot-blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.35; }
}
.admin-main {
  flex: 1;
  min-width: 0;
}

/* 概览页：四个数 + 一句话 + 最近动态 + 常用按钮。 */
.admin-ov-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin: 16px 0;
}
.admin-ov-card {
  background: rgba(255, 255, 255, 0.75);
  border-radius: 10px;
  padding: 14px 16px;
}
.admin-ov-num {
  font-size: 24px;
  font-weight: bold;
  line-height: 1.2;
}
.admin-ov-label {
  font-size: 13px;
  color: #656d76;
  margin-top: 2px;
}
.admin-ov-sub {
  font-size: 12px;
  color: #8b949e;
  margin-top: 6px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.admin-ov-bar {
  height: 6px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.08);
  margin-top: 10px;
  overflow: hidden;
}
.admin-ov-bar-fill {
  height: 100%;
  border-radius: 999px;
  background: rgb(57, 144, 155);
}
/* 不限量时进度条常显：斜纹填充表示“无上限”，与百分比实心填充区分。 */
.admin-ov-bar-fill.is-unlimited {
  width: 100%;
  background: repeating-linear-gradient(45deg, rgba(57, 144, 155, 0.28) 0 6px, rgba(57, 144, 155, 0.08) 6px 12px);
}
.admin-ov-sentence {
  font-size: 14px;
  color: #24292f;
  margin: 4px 0 20px;
}
.admin-ov-h3 {
  font-size: 15px;
  margin: 0 0 8px;
}
.admin-ov-activity {
  list-style: none;
  margin: 0 0 20px;
  padding: 0;
}
.admin-ov-activity li {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 2px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
  font-size: 14px;
}
.admin-ov-act-kind {
  flex: none;
  font-size: 12px;
  color: #656d76;
  background: rgba(0, 0, 0, 0.05);
  border-radius: 999px;
  padding: 2px 8px;
}
.admin-ov-act-main {
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.admin-ov-act-time {
  flex: none;
  font-size: 12px;
  color: #8b949e;
}
.admin-ov-act-empty {
  color: #8b949e;
}
.admin-ov-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

/* 挂载页表单：标签定宽，输入框自适应。 */
.admin-field-label {
  min-width: 100px;
  font-size: 14px;
  color: #333;
}
/* 作用域只读显示：等宽字、允许长 URL 换行，不可编辑。 */
.admin-scope {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  color: #57606a;
  word-break: break-all;
  flex: 1;
  min-width: 0;
}
.admin-coming {
  font-size: 12px;
  font-weight: normal;
  color: #8b949e;
  background: rgba(0, 0, 0, 0.05);
  border-radius: 999px;
  padding: 2px 8px;
  vertical-align: middle;
}
.admin-console section h2 {
  font-size: 18px;
  margin: 0 0 4px;
}
.admin-console section > p,
.admin-desc {
  color: dimgray;
  font-size: 14px;
  line-height: 1.6;
}
.admin-error {
  color: #c00;
  background: rgba(204, 0, 0, 0.07);
  border-radius: 10px;
  padding: 10px 14px;
  margin: 12px 0;
}
.admin-ok {
  color: #1a7a1a;
  background: rgba(26, 122, 26, 0.08);
  border-radius: 10px;
  padding: 10px 14px;
  margin: 12px 0;
}
.admin-warn {
  color: #7a5a00;
  background: rgba(255, 193, 7, 0.15);
  border-radius: 10px;
  padding: 10px 14px;
  margin: 12px 0;
}
.admin-busy {
  color: dimgray;
  font-size: 14px;
}
/* 短链总开关：拨动式开关，与后台青色主色一致；原生复选框只保留给读屏。 */
.switch-row {
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
}
.switch-label {
  font-weight: 600;
}
.switch {
  position: relative;
  display: inline-block;
}
.switch input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}
.switch-track {
  display: inline-block;
  width: 48px;
  height: 28px;
  border-radius: 14px;
  background: #c8c8c8;
  position: relative;
  transition: background 0.2s;
  vertical-align: middle;
}
.switch-thumb {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  transition: left 0.2s;
}
.switch input:checked + .switch-track {
  background: rgb(57, 144, 155);
}
.switch input:checked + .switch-track .switch-thumb {
  left: 23px;
}
.switch input:disabled + .switch-track {
  opacity: 0.5;
}
.switch-hint {
  color: #666;
  font-size: 14px;
}

.admin-row {
  display: flex;
  gap: 10px;
  align-items: center;
  margin: 10px 0;
  flex-wrap: wrap;
}
.admin-page .admin-row input:not([type="checkbox"]) {
  flex: 1;
  min-width: 160px;
}
.admin-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.admin-list li {
  display: flex;
  gap: 10px;
  align-items: center;
  background: rgba(255, 255, 255, 0.75);
  border-radius: 10px;
  padding: 12px 14px;
  flex-wrap: wrap;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
  transition: background-color 0.2s ease-in-out;
}
.admin-list li:hover {
  background: rgba(0, 0, 0, 0.02);
}
.admin-list li a {
  color: rgb(57, 144, 155);
}
.admin-name {
  cursor: pointer;
  flex: 1;
  min-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
/* 文件行：图标 + 两行信息（名称 / 日期·大小）+ 操作组，照前端 .file-item 的分层来，
   不再把名称、大小、四个按钮全挤在一行。 */
.admin-file-row {
  padding: 14px 16px;
}
.admin-file-icon {
  width: 48px;
  height: 48px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
.admin-file-icon svg,
.admin-file-icon img {
  display: block;
}
.admin-file-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.admin-file-name {
  font-size: 16px;
  line-height: 1.5;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.admin-folder-name {
  cursor: pointer;
}
.admin-file-meta {
  color: dimgray;
  font-size: 13px;
  line-height: 1.5;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.admin-file-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
  margin-left: auto;
}
.admin-up-row {
  cursor: pointer;
}
/* 受保护勾选行：整行可点，复选框 + 文件夹图标 + 名称 + 状态 pill */
.admin-check-row {
  display: flex;
  gap: 12px;
  align-items: center;
  width: 100%;
  cursor: pointer;
}
.admin-check-row input[type="checkbox"] {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  accent-color: rgb(57, 144, 155);
}
.admin-prot-tag {
  background: rgba(57, 144, 155, 0.12);
  color: rgb(45, 115, 124);
  border-radius: 50px;
  padding: 2px 10px;
  font-size: 12px;
  white-space: nowrap;
}
/* 文件树：展开符 + 半尺寸图标 + 名称 + pill；缩进按深度，窄屏靠省略号不溢出。
   展开符样式需压过 .admin-page button 的通用规则，故用 .admin-page 前缀提特异性。 */
.admin-tree-row {
  display: flex;
  gap: 8px;
  align-items: center;
  width: 100%;
  box-sizing: border-box;
}
.admin-page .admin-tree-exp {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: transparent;
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
  color: dimgray;
}
.admin-page .admin-tree-exp:disabled {
  cursor: default;
  opacity: 0.5;
}
.admin-tree-row .admin-tree-check {
  flex: 1;
  min-width: 0;
  width: auto;
}
.admin-tree-check .admin-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
/* 树图标取保护列表图标（36px）的一半：18px，仍用同一文件夹图形 */
.admin-tree-icon {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
.admin-tree-icon svg {
  width: 18px;
  height: 18px;
  display: block;
}
.admin-tree-covered {
  color: dimgray;
  font-size: 12px;
  white-space: nowrap;
  flex-shrink: 0;
}
.admin-tree-status,
.admin-tree-empty {
  color: dimgray;
  font-size: 13px;
  padding-top: 2px;
  padding-bottom: 2px;
}
.admin-subhead {
  font-size: 15px;
  margin: 20px 0 4px;
}
.admin-box {
  background: rgba(255, 255, 255, 0.75);
  border-radius: 10px;
  padding: 16px;
  margin: 16px 0;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
}
.admin-box h3 {
  margin: 0 0 12px;
  font-size: 16px;
}
.admin-box pre {
  background: whitesmoke;
  padding: 12px;
  overflow-x: auto;
  border-radius: 8px;
}
.admin-danger {
  color: #c00;
}
.admin-empty {
  color: dimgray;
  margin: 16px 0;
  padding: 28px 16px;
  text-align: center;
  border: 2px dashed #ddd;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.5);
}
.admin-rules {
  background: whitesmoke;
  padding: 12px 14px;
  border-radius: 10px;
}
.admin-user-row label {
  white-space: nowrap;
  font-size: 14px;
}
.admin-user-row strong {
  min-width: 80px;
}
.admin-page .admin-user-row input[type="password"] {
  width: 160px;
  flex: none;
}
.admin-picker-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  z-index: 100;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 40px 16px;
  overflow-y: auto;
  box-sizing: border-box;
}
.admin-picker {
  background: rgba(255, 255, 255, 0.97);
  backdrop-filter: blur(10px);
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
  padding: 24px;
  width: 100%;
  max-width: 640px;
  max-height: 80vh;
  overflow-y: auto;
  box-sizing: border-box;
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
.admin-picker h3 {
  margin: 0 0 12px;
  font-size: 16px;
}
/* 删除文件夹确认框：危险操作用红字标题 + 红色感叹号徽标，
   与行内红色「删除」文字按钮同色系；确认删除是实心红按钮。 */
.admin-delete-confirm {
  max-width: 480px;
}
.admin-delete-confirm-head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}
.admin-delete-confirm-head h3 {
  margin: 0;
  color: #c00;
}
.admin-delete-confirm-icon {
  flex: 0 0 auto;
  width: 28px;
  height: 28px;
  line-height: 28px;
  text-align: center;
  font-size: 18px;
  font-weight: 700;
  color: #fff;
  background: #c00;
  border-radius: 50%;
}
.admin-delete-confirm-name {
  margin: 0 0 8px;
  font-size: 17px;
  font-weight: 700;
  word-break: break-all;
}
.admin-delete-confirm-desc {
  margin: 0 0 8px;
  color: #444;
}
.admin-delete-confirm-list {
  margin: 0 0 16px;
  padding-left: 20px;
  color: #444;
}
.admin-delete-confirm-list li {
  margin: 4px 0;
}
.admin-delete-confirm-actions {
  justify-content: flex-end;
}
.admin-btn-danger {
  padding: 10px 24px;
  background: #c00;
  color: #fff;
  border: 0;
  border-radius: 50px;
  cursor: pointer;
  box-shadow: 2px 4px 6px rgba(0, 0, 0, 0.3);
}
.admin-btn-danger:disabled {
  opacity: 0.6;
  cursor: default;
}
/* 选择行整行可点；选中态用更高特异性压过列表行的 hover 背景 */
.admin-picker-row {
  cursor: pointer;
}
.admin-list li.admin-picker-selected,
.admin-picker-selected {
  background: rgba(57, 144, 155, 0.12);
}
@media (max-width: 600px) {
  .admin-console {
    padding: 16px;
  }
  .admin-login {
    margin-top: 40px;
    padding: 24px 16px;
  }
  .admin-who {
    margin-left: 0;
  }
  /* 窄屏下操作组另起一行，不跟名称挤在同一行 */
  .admin-file-actions {
    margin-left: 0;
    flex-basis: 100%;
  }
  /* 上传限制卡片窄屏单列 */
  .admin-limit-grid {
    grid-template-columns: 1fr;
  }
  /* 窄屏下侧栏收成顶部横向滚动导航 */
  .admin-layout {
    flex-direction: column;
    gap: 12px;
  }
  .admin-sidebar {
    flex: none;
    position: static;
    width: 100%;
    flex-direction: row;
    align-items: center;
    gap: 6px;
    overflow-x: auto;
    padding-bottom: 4px;
    scrollbar-width: none;
  }
  .admin-sidebar::-webkit-scrollbar {
    display: none;
  }
  .admin-sidebar .admin-nav-group {
    display: contents;
  }
  .admin-sidebar .admin-nav-group-title,
  .admin-sidebar .admin-nav-status {
    display: none;
  }
  .admin-page .admin-nav-item {
    flex: none;
    width: auto;
    white-space: nowrap;
  }
  /* 概览卡片窄屏两列 */
  .admin-ov-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

/* Admin upload queue: layout matches the starship layer; palette uses
   the original light language. */
.admin-upload-row {
  border: 1px solid #ddd;
  border-radius: 10px;
  padding: 10px 12px;
  margin: 10px 0;
}
.admin-upload-row-top {
  display: flex;
  align-items: center;
  gap: 8px;
}
.admin-upload-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.admin-upload-pill {
  flex: none;
  font-size: 13px;
  padding: 2px 10px;
  border-radius: 50px;
  background: whitesmoke;
}
.admin-upload-pill-uploading {
  background: rgba(57, 144, 155, 0.12);
  color: rgb(45, 115, 124);
}
.admin-upload-pill-done {
  color: #1a7a1a;
  background: rgba(26, 122, 26, 0.08);
}
.admin-upload-pill-failed {
  color: #c00;
  background: rgba(204, 0, 0, 0.07);
}
.admin-upload-pill-cleaned {
  color: #5b21b6;
  background: rgba(124, 58, 237, 0.10);
}
/* 分享管理：行可换行以容纳详情区；状态 pill 与短链类型 pill 沿用
   admin-upload-pill 的圆角 pill 语言；详情区占整行宽度。 */
.share-row {
  flex-wrap: wrap;
}
.share-filter {
  flex-wrap: wrap;
}
.share-status-pill,
.share-type-pill {
  flex: none;
  font-size: 13px;
  padding: 2px 10px;
  border-radius: 50px;
  background: whitesmoke;
}
.share-status-active {
  color: #1a7a1a;
  background: rgba(26, 122, 26, 0.08);
}
.share-status-expired,
.share-status-disabled {
  color: #666;
  background: rgba(0, 0, 0, 0.06);
}
.share-status-locked {
  color: #8a5a00;
  background: rgba(255, 193, 7, 0.18);
}
.share-detail {
  flex-basis: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px 0 4px;
  border-top: 1px dashed rgba(0, 0, 0, 0.12);
}
.share-detail-section h4 {
  margin: 0 0 8px;
}
.admin-progress {
  height: 8px;
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.08);
  overflow: hidden;
  margin: 8px 0;
}
.admin-progress-fill {
  height: 100%;
  background: rgb(57, 144, 155);
  transition: width 0.2s ease;
}
.admin-upload-row-bottom {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}
.admin-upload-meta {
  color: dimgray;
}
.admin-upload-note {
  color: #2c2c2c;
}
.admin-upload-error {
  color: #c00;
}
.admin-upload-actions {
  margin-left: auto;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.admin-upload-actions button {
  font-size: 13px;
  padding: 4px 10px;
}
.admin-upload-batchbar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin-top: 12px;
}
.admin-upload-totalbar {
  flex: 1 1 100%;
}
.admin-upload-total {
  font-size: 13px;
  color: dimgray;
}

/* Theme skin cards (admin skin tab): light base palette. */
.admin-skin-cards {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 12px;
}
.admin-skin-card {
  flex: 1 1 240px;
  border: 1px solid #ddd;
  border-radius: 12px;
  padding: 16px;
  background: whitesmoke;
}
.admin-skin-card.on {
  border-color: rgb(57, 144, 155);
}
.admin-skin-current {
  display: inline-block;
  font-size: 13px;
  padding: 2px 10px;
  border-radius: 50px;
  background: rgba(57, 144, 155, 0.12);
  color: rgb(45, 115, 124);
}
</style>
