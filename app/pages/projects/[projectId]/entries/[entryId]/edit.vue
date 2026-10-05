<script setup lang="ts">
import { validateEntry } from '../../../../../utils/entry-form'
import type { EntryType } from '#shared/entry-types'

const route = useRoute()
const projectPath = computed(() => `/projects/${encodeURIComponent(String(route.params.projectId))}`)
const entryPath = computed(() => `${projectPath.value}/entries/${encodeURIComponent(String(route.params.entryId))}`)
const { data: entry, status, error, refresh } = useFetch(() => `/api/projects/${encodeURIComponent(String(route.params.projectId))}/entries/${encodeURIComponent(String(route.params.entryId))}`, {
  server: false,
  retry: 0
})
const state = ref({ title: '', body: '', types: [] as EntryType[] })
watch(entry, (value) => {
  if (value) state.value = { title: value.title, body: value.body, types: [...value.types] }
}, { immediate: true })
const isSaving = ref(false)
const saveError = ref('')

async function saveEntry() {
  if (isSaving.value || validateEntry(state.value).length) return
  isSaving.value = true
  saveError.value = ''
  try {
    await $fetch(`/api${entryPath.value}`, {
      method: 'PATCH',
      retry: 0,
      body: { title: state.value.title.trim(), body: state.value.body.trim(), types: [...state.value.types] }
    })
  } catch (error) {
    saveError.value = error !== null && typeof error === 'object' && 'statusCode' in error && error.statusCode === 400
      ? '入力内容を確認して、もう一度保存してください。'
      : 'Entryの保存に失敗しました。時間をおいて再試行してください。'
    isSaving.value = false
    return
  }
  // 保存済みの内容を再送信しないよう、遷移まで送信を無効にする。
  await navigateTo(entryPath.value)
}

useSeoMeta({ title: 'Entry編集 | DevRecall' })
</script>

<template>
  <UContainer class="py-10">
    <h1 class="mb-8 text-3xl font-bold text-highlighted">
      Entry編集
    </h1>
    <p
      v-if="status === 'idle' || status === 'pending'"
      role="status"
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
        label="再試行"
        class="mt-4"
        @click="refresh()"
      />
    </div>
    <UButton
      v-if="!entry || error"
      :to="projectPath"
      label="Project詳細へ戻る"
      class="mt-4"
    />
    <UCard v-if="status === 'success' && entry && !error">
      <UForm
        novalidate
        :state="state"
        :validate="validateEntry"
        :disabled="isSaving"
        class="space-y-4"
        @submit="saveEntry"
      >
        <EntryFields v-model="state" />
        <UAlert
          v-if="saveError"
          role="alert"
          color="error"
          :title="saveError"
        />
        <div class="flex gap-2">
          <UButton
            type="submit"
            :label="isSaving ? '保存中…' : '保存'"
            :loading="isSaving"
            :disabled="isSaving"
          />
          <UButton
            :to="entryPath"
            label="キャンセル"
            color="neutral"
            variant="outline"
            :disabled="isSaving"
          />
        </div>
      </UForm>
    </UCard>
  </UContainer>
</template>
