<script setup lang="ts">
import type { FormError } from '@nuxt/ui'

const { data: projects, status, error: listError, refresh } = useFetch('/api/projects', {
  server: false,
  retry: 0
})

const isCreateFormOpen = ref(false)
const state = reactive({ name: '' })
const isSaving = ref(false)
const savedProjectName = ref('')
const saveError = ref('')

watch(() => state.name, () => {
  savedProjectName.value = ''
  saveError.value = ''
}, { flush: 'sync' })

function openCreateForm() {
  state.name = ''
  savedProjectName.value = ''
  saveError.value = ''
  isCreateFormOpen.value = true
}

function validateProjectName(state: { name: string }): FormError[] {
  return state.name.trim()
    ? []
    : [{ name: 'name', message: 'Project名を入力してください（空白のみは使えません）。' }]
}

async function saveProject() {
  const name = state.name.trim()
  if (isSaving.value || !name) return

  isSaving.value = true
  savedProjectName.value = ''
  saveError.value = ''
  try {
    const project = await $fetch('/api/projects', {
      method: 'POST',
      body: { name }
    })
    // 同期watchによるメッセージ消去を終えてから、今回の成功を表示する。
    state.name = ''
    savedProjectName.value = project.name
  } catch (error) {
    saveError.value = error !== null && typeof error === 'object' && 'statusCode' in error && error.statusCode === 400
      ? 'Project名を確認して、もう一度保存してください。'
      : 'Projectの保存に失敗しました。時間をおいて再試行してください。'
  } finally {
    isSaving.value = false
  }

  // useFetchは再取得失敗をlistErrorへ保持する。保存結果とは別に扱う。
  if (savedProjectName.value) await refresh()
}

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
        保存したProjectは一覧に表示されます。
      </p>
      <UForm
        :state="state"
        :validate="validateProjectName"
        class="space-y-4"
        :disabled="isSaving"
        @submit="saveProject"
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
          v-if="savedProjectName"
          role="status"
          class="text-sm text-muted"
        >
          Project「{{ savedProjectName }}」を保存しました。
        </p>
        <p
          v-if="saveError"
          role="alert"
          class="text-sm text-error"
        >
          {{ saveError }}
        </p>
        <div class="flex gap-2">
          <UButton
            type="submit"
            :label="isSaving ? '保存中…' : '保存'"
            :loading="isSaving"
            :disabled="isSaving || !state.name.trim()"
          />
          <UButton
            type="button"
            label="キャンセル"
            color="neutral"
            variant="outline"
            :disabled="isSaving"
            @click="isCreateFormOpen = false"
          />
        </div>
      </UForm>
    </UCard>

    <p
      v-if="status === 'idle' || status === 'pending'"
      role="status"
      class="text-sm text-muted"
    >
      Project一覧を読み込み中…
    </p>
    <div v-else-if="listError">
      <UAlert
        role="alert"
        color="error"
        title="Project一覧の取得に失敗しました。再試行してください。"
      />
      <UButton
        class="mt-4"
        label="再試行"
        @click="refresh()"
      />
    </div>
    <template v-else-if="projects && projects.length > 0">
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
              <NuxtLink
                :to="`/projects/${project.id}`"
                class="hover:underline"
              >
                {{ project.name }}
              </NuxtLink>
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
