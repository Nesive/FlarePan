<template>
  <div class="admin-page">
    <!-- 登录页：整页表单，杜绝遮罩冒泡误关 -->
    <div v-if="view === 'login'" class="admin-login">
      <h1>网盘管理后台</h1>
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
        <h1>网盘管理后台</h1>
        <span v-if="user" class="admin-who">当前账号：{{ user }}</span>
        <button @click="doLogout" class="admin-btn">退出</button>
      </div>
      <nav class="admin-tabs">
        <button
          :class="{ on: tab === 'files' }"
          @click="switchTab('files')">文件</button>
        <button
          :class="{ on: tab === 'protection' }"
          @click="switchTab('protection')">受保护文件夹</button>
        <button
          :class="{ on: tab === 'shares' }"
          @click="switchTab('shares')">分享</button>
        <button
          :class="{ on: tab === 'dav' }"
          @click="switchTab('dav')">WebDAV</button>
        <button
          :class="{ on: tab === 'shorten' }"
          @click="switchTab('shorten')">短链</button>
        <button
          :class="{ on: tab === 'accounts' }"
          @click="switchTab('accounts')">账号</button>
        <button
          :class="{ on: tab === 'permissions' }"
          @click="switchTab('permissions')">权限</button>
        <button
          :class="{ on: tab === 'limits' }"
          @click="switchTab('limits')">上传限制</button>
      </nav>
      <div v-if="globalError" class="admin-error">{{ globalError }}</div>

      <!-- 文件页 -->
      <section v-if="tab === 'files'">
        <h2>文件</h2>
        <div class="admin-row">
          <span>当前目录：{{ cwd || "/" }}</span>
        </div>
        <div v-if="filesError" class="admin-error">{{ filesError }}</div>
        <div v-if="filesLoading">加载中...</div>
        <ul v-else class="admin-list">
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
          <input type="file" ref="uploadInput" />
          <button @click="uploadFile">上传</button>
          <div v-if="uploadError" class="admin-error">{{ uploadError }}</div>
          <div v-if="uploadOk" class="admin-ok">{{ uploadOk }}</div>
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
        <p class="admin-desc">给受保护文件夹生成分享链接与提取码，访客不用登录，输对码就能浏览和下载该文件夹。提取码只在创建或重新生成时显示一次，之后任何地方都拿不回原文，丢了只能重新生成。</p>
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
        <ul class="admin-list">
          <li v-for="s in shares" :key="s.slug" class="admin-user-row">
            <span><strong>{{ s.prefix }}</strong></span>
            <span><code>{{ shareLinkOf(s) }}</code></span>
            <span>{{ shareExpiryText(s) }}</span>
            <button @click="copyShareLink(s)">复制链接</button>
            <button v-if="shortenEnabled" @click="copyShareShortLink(s)">复制短链</button>
            <button @click="regenerateShare(s)">重新生成提取码</button>
            <button @click="deleteShare(s)" class="admin-danger">撤销</button>
          </li>
        </ul>
        <div v-if="!shares.length && !shareError" class="admin-empty">暂无分享</div>
      </section>

      <!-- WebDAV 页 -->
      <section v-if="tab === 'dav'">
        <h2>WebDAV</h2>
        <div v-if="davError" class="admin-error">{{ davError }}</div>
        <div v-if="davOk" class="admin-ok">{{ davOk }}</div>
        <label class="admin-row">
          <input
            type="checkbox"
            v-model="davEnabled"
            :disabled="davEnabled === null" />
          启用 WebDAV
        </label>
        <div class="admin-row">
          <button
            @click="saveDav"
            :disabled="davEnabled === null"
            class="admin-btn-primary">保存</button>
        </div>
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

      <section v-if="tab === 'limits'">
        <h2>上传限制</h2>
        <p class="admin-desc">防恶意上传的额度：单文件上限、每身份每日量、存储总量、过期时间。总量填 0 表示不限量，过期填 0 表示永不过期；其余两项必须大于 0。过期文件在每次上传时顺带清理（每次最多 50 条），总量上限是硬兜底，即使清理延迟也不会冲爆额度。</p>
        <div v-if="limitError" class="admin-error">{{ limitError }}</div>
        <div v-if="limitOk" class="admin-ok">{{ limitOk }}</div>
        <div class="admin-row">
          <span>单文件上限（MB）</span>
          <input v-model.number="limitMaxFile" type="number" min="1" />
        </div>
        <div class="admin-row">
          <span>每身份每日量（MB）</span>
          <input v-model.number="limitDaily" type="number" min="1" />
        </div>
        <div class="admin-row">
          <span>存储总量（MB，0 = 不限）</span>
          <input v-model.number="limitTotal" type="number" min="0" />
        </div>
        <div class="admin-row">
          <span>过期时间（小时，0 = 永不过期）</span>
          <input v-model.number="limitExpiry" type="number" min="0" />
        </div>
        <div class="admin-row">
          <button @click="saveLimits" class="admin-btn-primary">保存</button>
        </div>
      </section>
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
  </div>
</template>

<script>
import MimeIcon from './MimeIcon.vue';

// 前端文件列表用的文件夹图标原物（App.vue 内联 SVG，viewBox 0 0 576 512），
// 管理后台文件行与受保护勾选行直接复用同一图形，不再用 emoji 占位。
const FolderIcon = {
  template: `<svg viewBox="0 0 576 512" xmlns="http://www.w3.org/2000/svg" width="36" height="36"><path d="M384 480l48 0c11.4 0 21.9-6 27.6-15.9l112-192c5.8-9.9 5.8-22.1 .1-32.1S555.5 224 544 224l-400 0c-11.4 0-21.9 6-27.6 15.9L48 357.1 48 96c0-8.8 7.2-16 16-16l117.5 0c4.2 0 8.3 1.7 11.3 4.7l26.5 26.5c21 21 49.5 32.8 79.2 32.8L416 144c8.8 0 16 7.2 16 16l0 32 48 0 0-32c0-35.3-28.7-64-64-64L298.5 96c-17 0-33.3-6.7-45.3-18.7L226.7 50.7c-12-12-28.3-18.7-45.3-18.7L64 32C28.7 32 0 60.7 0 96L0 416c0 35.3 28.7 64 64 64l23.7 0L384 480z"/></svg>`,
};

export default {
  components: { MimeIcon, FolderIcon },
  data: () => ({
    view: 'login',
    tab: 'files',
    user: null,
    loginUser: '',
    loginPass: '',
    loginError: '',
    loginBusy: false,
    globalError: '',
    // 文件
    cwd: '',
    files: [],
    folders: [],
    filesLoading: false,
    filesError: '',
    uploadError: '',
    uploadOk: '',
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
    davError: '',
    davOk: '',
    davCopyOk: '',
    // 短链（总开关：关闭时全部短链入口与配置区隐藏，开关本身常驻）。
    shortenEnabled: true,
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
    shareBusy: false,
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
        this.tab = 'files';
        this.fetchFilesAdmin();
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

    switchTab(t) {
      this.tab = t;
      this.globalError = '';
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

    formatDate(t) {
      if (!t) return '—';
      const d = new Date(t);
      return isNaN(d.getTime()) ? '—' : d.toLocaleString();
    },

    // ---- 文件 ----
    async fetchFilesAdmin() {
      this.filesLoading = true;
      this.filesError = '';
      try {
        const res = await fetch(`/api/children/${this.cwd}`);
        if (res.status === 401) {
          this.goLogin('登录已失效，请重新登录');
          return;
        }
        if (!res.ok) throw new Error('http_' + res.status);
        const data = await this.readJson(res);
        this.files = data.value || [];
        this.folders = data.folders || [];
      } catch (e) {
        this.files = [];
        this.folders = [];
        this.filesError = '加载失败，请稍后重试';
      } finally {
        this.filesLoading = false;
      }
    },

    goUp() {
      this.cwd = this.cwd.replace(/[^\/]+\/$/, '');
      this.fetchFilesAdmin();
    },

    async uploadFile() {
      this.uploadError = '';
      this.uploadOk = '';
      const input = this.$refs.uploadInput;
      if (!input || !input.files || !input.files.length) {
        this.uploadError = '请先选择要上传的文件';
        return;
      }
      const fd = new FormData();
      fd.append('file', input.files[0]);
      fd.append('path', this.cwd);
      try {
        const res = await fetch('/api/admin/files/upload',
        { method: 'POST', body: fd });
        if (res.status === 401) {
          this.goLogin('登录已失效，请重新登录');
          return;
        }
        if (!res.ok) {
          const data = await this.readJson(res);
          this.uploadError = data.error ? `上传失败：${data.error}` : '上传失败，请重试';
          return;
        }
        this.uploadOk = '上传成功';
        input.value = '';
        this.fetchFilesAdmin();
      } catch (e) {
        this.uploadError = '上传失败，请重试';
      }
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
        try {
          await navigator.clipboard.writeText(data.shortLink);
          this.actionOk = '短链已复制：' + data.shortLink;
        } catch (e) {
          window.prompt('短链地址（请手动复制）：', data.shortLink);
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
        this.protTopFolders = data.folders || [];
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
        const children = data.folders || [];
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
        const children = data.folders || [];
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
        if (!res.ok) {
          const data = await this.readJson(res);
          this.davError = data.error ? `保存失败：${data.error}` : '保存失败，请重试';
          return;
        }
        this.davOk = '已保存';
      } catch (e) {
        this.davError = '保存失败，请重试';
      }
    },

    async copyDavAddr() {
      this.davCopyOk = '';
      try {
        await navigator.clipboard.writeText(this.davAddr);
        this.davCopyOk = '已复制';
      } catch (e) {
        window.prompt('WebDAV 地址（请手动复制）：', this.davAddr);
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

    async copyShareLink(s) {
      try {
        await navigator.clipboard.writeText(this.shareLinkOf(s));
        this.shareOk = '链接已复制';
      } catch (e) {
        this.shareError = '复制失败，请手动复制链接';
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
        try {
          await navigator.clipboard.writeText(data.shortLink);
          this.shareOk = '短链已复制：' + data.shortLink;
        } catch (e) {
          window.prompt('短链地址（请手动复制）：', data.shortLink);
        }
      } catch (e) {
        this.shareError = '复制短链失败，请重试';
      }
    },

    async copyShareResult() {
      if (!this.shareResult) return;
      try {
        await navigator.clipboard.writeText(
          `链接：${this.shareResultLink}\n提取码：${this.shareResult.code}`
        );
        this.shareOk = '链接与提取码已复制';
      } catch (e) {
        this.shareError = '复制失败，请手动复制';
      }
    },

    // 带提取码的链接：origin + /s/<slug> + ?code=<code>，访客打开即自动验码。
    // 只在生成/重新生成结果框里出现（提取码只显示一次，列表里拿不回原文）。
    async copyShareCodeLink() {
      if (!this.shareResult) return;
      const link = this
      .shareResultLink + '?code=' + encodeURIComponent(this.shareResult.code);
      try {
        await navigator.clipboard.writeText(link);
        this.shareOk = '带提取码的链接已复制';
      } catch (e) {
        window.prompt('带提取码的链接（请手动复制）：', link);
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
        try {
          await navigator.clipboard.writeText(data.shortLink);
          this.shareOk = '带提取码的短链已复制：' + data.shortLink;
        } catch (e) {
          window.prompt('带提取码的短链（请手动复制）：', data.shortLink);
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
      })
      .catch(() => {});
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
.admin-page input:not([type]) {
  background-color: whitesmoke;
  border: none;
  border-radius: 16px;
  padding: 10px 14px;
  box-sizing: border-box;
  font-size: 15px;
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
  max-width: 900px;
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
.admin-tabs {
  display: flex;
  gap: 8px;
  margin: 16px 0 24px;
  flex-wrap: wrap;
  background: rgba(255, 255, 255, 0.5);
  backdrop-filter: blur(10px);
  border-radius: 50px;
  padding: 6px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  width: fit-content;
  max-width: 100%;
}
.admin-page .admin-tabs button {
  padding: 8px 18px;
  border-radius: 50px;
  background: transparent;
}
.admin-page .admin-tabs button:hover:not(.on) {
  background: rgba(0, 0, 0, 0.06);
}
.admin-page .admin-tabs button.on {
  background: rgb(57, 144, 155);
  color: #fff;
  font-weight: bold;
  box-shadow: 2px 4px 6px rgba(0, 0, 0, 0.3);
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
.admin-details {
  background: rgba(255, 255, 255, 0.5);
  border-radius: 10px;
  padding: 12px 16px;
  margin: 16px 0;
}
.admin-details summary {
  cursor: pointer;
  font-size: 14px;
  color: dimgray;
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
.admin-picker h3 {
  margin: 0 0 12px;
  font-size: 16px;
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
}
</style>
