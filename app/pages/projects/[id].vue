<script setup lang="ts">
import { entryTypeLabels } from '#shared/entry-types'

const route = useRoute()
const { data: project, status, error, refresh } = useFetch(() => `/api/projects/${encodeURIComponent(String(route.params.id))}`, {
  server: false,
  retry: 0
})

const searchInput = ref('')
const searchKeyword = ref('')
const { data: entries, status: entriesStatus, error: entriesError, refresh: refreshEntries } = useFetch(() => `/api/projects/${encodeURIComponent(String(route.params.id))}/entries`, {
  server: false,
  retry: 0,
  query: computed(() => searchKeyword.value ? { q: searchKeyword.value } : {}),
  // 作成画面から戻る場合もキャッシュではなくAPIから最新の一覧を取得する。
  getCachedData: () => undefined
})

function searchEntries() {
  const keyword = searchInput.value.trim()
  if (keyword === searchKeyword.value) {
    refreshEntries()
  } else {
    // useFetchが条件の変更を監視する。入力中には取得しない。
    searchKeyword.value = keyword
  }
}

function clearSearch() {
  searchInput.value = ''
  searchEntries()
}

useSeoMeta({ title: 'Project詳細 | DevRecall' })
</script>

<template>
  <UContainer class="py-10">
    <UButton
      to="/"
      label="Project一覧へ戻る"
      color="neutral"
      variant="outline"
      class="mb-8"
    />
    <p
      v-if="status === 'idle' || status === 'pending'"
      role="status"
      class="text-sm text-muted"
    >
      Projectを読み込み中…
    </p>
    <div v-else-if="error">
      <UAlert
        role="alert"
        color="error"
        :title="error.statusCode === 404 ? 'Projectが見つかりません。' : 'Projectの取得に失敗しました。再試行してください。'"
      />
      <UButton
        v-if="error.statusCode !== 404"
        class="mt-4"
        label="再試行"
        @click="refresh()"
      />
    </div>
    <template v-else-if="project">
      <h1 class="text-3xl font-bold text-highlighted wrap-anywhere">
        {{ project.name }}
      </h1>
      <p class="mt-2 text-sm text-muted">
        作成日時：
        <time :datetime="project.createdAt">{{ new Date(project.createdAt).toLocaleString('ja-JP') }}</time>
      </p>
      <UCard class="mt-8">
        <template #header>
          <h2 class="text-lg font-semibold text-highlighted">
            Entries
          </h2>
        </template>
        <form
          class="mb-4 space-y-2"
          @submit.prevent="searchEntries"
        >
          <UFormField
            label="Entry検索"
            name="search"
          >
            <UInput
              v-model="searchInput"
              placeholder="タイトル・本文のキーワード"
              class="w-full"
            />
          </UFormField>
          <div class="flex gap-2">
            <UButton
              type="submit"
              label="検索"
            />
            <UButton
              type="button"
              label="クリア"
              color="neutral"
              variant="outline"
              @click="clearSearch"
            />
          </div>
        </form>
        <p
          v-if="searchKeyword"
          class="mb-4 text-sm text-muted wrap-anywhere"
        >
          検索条件：{{ searchKeyword }}
        </p>
        <p
          v-if="entriesStatus === 'idle' || entriesStatus === 'pending'"
          role="status"
          class="text-sm text-muted"
        >
          Entry一覧を読み込み中…
        </p>
        <div v-else-if="entriesError">
          <UAlert
            role="alert"
            color="error"
            title="Entry一覧の取得に失敗しました。再試行してください。"
          />
          <UButton
            class="mt-4"
            label="Entry一覧を再試行"
            @click="refreshEntries()"
          />
        </div>
        <p
          v-else-if="!entries?.length"
          class="text-muted"
        >
          {{ searchKeyword ? '検索条件に一致するEntryがありません。' : 'まだEntryがありません' }}
        </p>
        <ul
          v-else
          class="space-y-4"
        >
          <li
            v-for="entry in entries"
            :key="entry.id"
          >
            <UCard>
              <h3 class="text-lg font-semibold wrap-anywhere">
                <NuxtLink
                  :to="`/projects/${entry.projectId}/entries/${entry.id}`"
                  class="text-primary hover:underline"
                >
                  {{ entry.title }}
                </NuxtLink>
              </h3>
              <div class="mt-2 flex flex-wrap gap-2">
                <UBadge
                  v-for="type in entry.types"
                  :key="type"
                  color="neutral"
                  variant="subtle"
                >
                  {{ entryTypeLabels[type] }}
                </UBadge>
              </div>
              <p class="mt-2 line-clamp-3 whitespace-pre-wrap text-muted wrap-anywhere">
                {{ entry.body.length > 200 ? `${entry.body.slice(0, 200)}…` : entry.body }}
              </p>
              <p class="mt-2 text-sm text-muted">
                作成日時：
                <time :datetime="entry.createdAt">{{ new Date(entry.createdAt).toLocaleString('ja-JP') }}</time>
              </p>
            </UCard>
          </li>
        </ul>
        <UButton
          :to="`/projects/${project.id}/entries/new`"
          label="Entryを追加"
          class="mt-4"
        />
      </UCard>
    </template>
  </UContainer>
</template>
