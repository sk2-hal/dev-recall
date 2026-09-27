<script setup lang="ts">
const route = useRoute()
const { data: project, status, error, refresh } = useFetch(() => `/api/projects/${encodeURIComponent(String(route.params.id))}`, {
  server: false,
  retry: 0
})

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
            Entry
          </h2>
        </template>
        <p class="text-muted">
          Entry機能は今後実装します
        </p>
      </UCard>
    </template>
  </UContainer>
</template>
