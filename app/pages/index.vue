<script setup lang="ts">
import type { FormError } from '@nuxt/ui'

const isCreateFormOpen = ref(false)
const state = reactive({ name: '' })
const isNameChecked = ref(false)

function openCreateForm() {
  state.name = ''
  isNameChecked.value = false
  isCreateFormOpen.value = true
}

function validateProjectName(state: { name: string }): FormError[] {
  return state.name.trim()
    ? []
    : [{ name: 'name', message: 'Project名を入力してください（空白のみは使えません）。' }]
}

watch(() => state.name, () => {
  isNameChecked.value = false
})

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
      <UButton
        v-if="!isCreateFormOpen"
        class="mt-4 block"
        label="新規Project"
        @click="openCreateForm"
      />
    </div>

    <UCard
      v-if="isCreateFormOpen"
      class="mb-8"
    >
      <template #header>
        <h2 class="text-lg font-semibold text-highlighted">
          新規Project
        </h2>
      </template>

      <p class="mb-4 text-sm text-muted">
        現在は入力確認のみ利用できます。保存機能は未実装のため、Projectは作成・保存されません。
      </p>
      <UForm
        :state="state"
        :validate="validateProjectName"
        class="space-y-4"
        @submit="isNameChecked = true"
      >
        <UFormField
          label="Project名"
          name="name"
          required
        >
          <UInput
            v-model="state.name"
            class="w-full"
            autofocus
          />
        </UFormField>
        <p
          v-if="isNameChecked"
          role="status"
          class="text-sm text-muted"
        >
          Project名の入力を確認しました。Projectは保存されていません。
        </p>
        <div class="flex gap-2">
          <UButton
            type="submit"
            label="入力を確認"
          />
          <UButton
            type="button"
            label="キャンセル"
            color="neutral"
            variant="outline"
            @click="isCreateFormOpen = false"
          />
        </div>
      </UForm>
    </UCard>

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
