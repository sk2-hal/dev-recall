<script setup lang="ts">
import { entryTypeLabels } from '#shared/entry-types'

const route = useRoute()
const projectUrl = computed(() => `/projects/${encodeURIComponent(String(route.params.projectId))}`)
const { data: entry, status, error, refresh } = useFetch(() => `/api/projects/${encodeURIComponent(String(route.params.projectId))}/entries/${encodeURIComponent(String(route.params.entryId))}`, {
  server: false,
  retry: 0
})

const isDeleting = ref(false)
const deleteError = ref('')

async function removeEntry() {
  if (isDeleting.value || !entry.value) return
  if (!window.confirm('このEntryを削除しますか？この操作は取り消せません。')) return
  isDeleting.value = true
  deleteError.value = ''
  try {
    await $fetch(`/api/projects/${encodeURIComponent(String(route.params.projectId))}/entries/${encodeURIComponent(String(route.params.entryId))}`, {
      method: 'DELETE',
      retry: 0
    })
  } catch (error) {
    const statusCode = (error as { statusCode?: number }).statusCode
    deleteError.value = statusCode === 404
      ? 'Entryが見つかりません。すでに削除された可能性があります。Project詳細へ戻って確認してください。'
      : 'Entryの削除に失敗しました。再試行してください。'
    isDeleting.value = false
    return
  }
  await navigateTo(projectUrl.value)
}

useSeoMeta({ title: 'Entry詳細 | DevRecall' })
</script>

<template>
  <UContainer class="py-10">
    <UButton
      :to="projectUrl"
      label="Project詳細へ戻る"
      :disabled="isDeleting"
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
        :disabled="isDeleting"
        class="mb-4"
      />
      <UButton
        label="削除"
        color="error"
        variant="outline"
        class="mb-4 ml-2"
        :loading="isDeleting"
        :disabled="isDeleting"
        @click="removeEntry"
      />
      <UAlert
        v-if="deleteError"
        role="alert"
        color="error"
        :title="deleteError"
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
      <EntryTags :tags="entry.tags" />
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
