<script setup lang="ts">
import { validateEntry, normalizeTags } from '../../../../utils/entry-form'
import type { EntryType } from '#shared/entry-types'

const route = useRoute()
const projectPath = computed(() => `/projects/${encodeURIComponent(String(route.params.projectId))}`)
const state = ref({ title: '', body: '', types: [] as EntryType[], tags: [] as string[] })
const isSaving = ref(false)
const saveError = ref('')

async function saveEntry() {
  if (isSaving.value || validateEntry(state.value).length) return
  isSaving.value = true
  saveError.value = ''
  try {
    await $fetch(`/api${projectPath.value}/entries`, {
      method: 'POST',
      retry: 0,
      body: { title: state.value.title.trim(), body: state.value.body.trim(), types: [...state.value.types], tags: normalizeTags(state.value.tags) }
    })
  } catch (error) {
    saveError.value = error !== null && typeof error === 'object' && 'statusCode' in error && error.statusCode === 400
      ? '入力内容を確認して、もう一度保存してください。'
      : 'Entryの保存に失敗しました。時間をおいて再試行してください。'
    isSaving.value = false
    return
  }
  // 保存済みの内容を再送信しないよう、遷移まで送信を無効にする。
  await navigateTo(projectPath.value)
}

useSeoMeta({ title: 'Entry作成 | DevRecall' })
</script>

<template>
  <UContainer class="py-10">
    <h1 class="mb-8 text-3xl font-bold text-highlighted">
      Entry作成
    </h1>
    <UCard>
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
            :to="projectPath"
            label="Project詳細へ戻る"
            color="neutral"
            variant="outline"
            :disabled="isSaving"
          />
        </div>
      </UForm>
    </UCard>
  </UContainer>
</template>
