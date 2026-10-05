<script setup lang="ts">
import { entryTypeLabels } from '#shared/entry-types'

const route = useRoute()
const projectUrl = computed(() => `/projects/${encodeURIComponent(String(route.params.projectId))}`)
const { data: entry, status, error, refresh } = useFetch(() => `/api/projects/${encodeURIComponent(String(route.params.projectId))}/entries/${encodeURIComponent(String(route.params.entryId))}`, {
  server: false,
  retry: 0
})

useSeoMeta({ title: 'Entry詳細 | DevRecall' })
</script>

<template>
  <UContainer class="py-10">
    <UButton
      :to="projectUrl"
      label="Project詳細へ戻る"
      color="neutral"
      variant="outline"
      class="mb-8"
    />
    <p
      v-if="status === 'idle' || status === 'pending'"
      role="status"
      class="text-sm text-muted"
    >
      Entryを読み込み中…
    </p>
    <div v-else-if="error">
      <UAlert
        role="alert"
        color="error"
        :title="error.statusCode === 404 ? 'Entryが見つかりません。' : 'Entryの取得に失敗しました。再試行してください。'"
      />
      <UButton
        v-if="error.statusCode !== 404"
        class="mt-4"
        label="再試行"
        @click="refresh()"
      />
    </div>
    <article v-else-if="entry">
      <UButton
        :to="`${projectUrl}/entries/${encodeURIComponent(String(route.params.entryId))}/edit`"
        label="編集"
        class="mb-4"
      />
      <h1 class="text-3xl font-bold text-highlighted wrap-anywhere">
        {{ entry.title }}
      </h1>
      <div class="mt-4 flex flex-wrap gap-2">
        <UBadge
          v-for="type in entry.types"
          :key="type"
          color="neutral"
          variant="subtle"
        >
          {{ entryTypeLabels[type] }}
        </UBadge>
      </div>
      <p class="mt-4 text-sm text-muted">
        作成日時：
        <time :datetime="entry.createdAt">{{ new Date(entry.createdAt).toLocaleString('ja-JP') }}</time>
      </p>
      <p class="mt-2 text-sm text-muted">
        更新日時：
        <time :datetime="entry.updatedAt">{{ new Date(entry.updatedAt).toLocaleString('ja-JP') }}</time>
      </p>
      <h2 class="mt-8 text-lg font-semibold">
        Body
      </h2>
      <p class="mt-2 whitespace-pre-wrap wrap-anywhere">
        {{ entry.body }}
      </p>
    </article>
  </UContainer>
</template>
