<script setup lang="ts">
// 空状態を確認するときは、この配列を [] にする。
const projects: { id: string, name: string }[] = [
  { id: 'dev-recall', name: 'DevRecall' },
  { id: 'nuxt-learning', name: 'Nuxt学習ノート' },
  { id: 'dotnet-api', name: '.NET API開発' }
]

useSeoMeta({
  title: 'Projects | DevRecall'
})
</script>

<template>
  <UContainer class="py-10">
    <div class="mb-8">
      <h1 class="text-3xl font-bold text-highlighted">
        Projects
      </h1>
      <p class="mt-2 text-muted">
        開発で得た判断・問題・解決・学びを、Projectごとに整理します。
      </p>
      <UBadge
        class="mt-4"
        color="neutral"
        variant="subtle"
        label="サンプルデータ"
      />
    </div>

    <template v-if="projects.length > 0">
      <p class="mb-4 text-sm text-muted">
        {{ projects.length }}件のProject
      </p>
      <ul class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <li
          v-for="project in projects"
          :key="project.id"
        >
          <UCard class="h-full">
            <h2 class="text-lg font-semibold text-highlighted wrap-anywhere">
              {{ project.name }}
            </h2>
          </UCard>
        </li>
      </ul>
    </template>

    <UEmpty
      v-else
      icon="i-lucide-folder"
      title="Projectはまだありません"
      description="作成したProjectがここに表示されます。"
    />
  </UContainer>
</template>
