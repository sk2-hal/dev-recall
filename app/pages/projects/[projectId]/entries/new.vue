<script setup lang="ts">
import type { FormError } from '@nuxt/ui'
import { entryTypes, entryTypeLabels, type EntryType } from '#shared/entry-types'

const route = useRoute()
const projectPath = computed(() => `/projects/${encodeURIComponent(String(route.params.projectId))}`)
const state = reactive({ title: '', body: '', types: [] as EntryType[] })
const isSaving = ref(false)
const saveError = ref('')
const typeItems = entryTypes.map(value => ({ value, label: entryTypeLabels[value] }))

function validateEntry(input: typeof state): FormError[] {
  const errors: FormError[] = []
  if (!input.title.trim()) errors.push({ name: 'title', message: 'Titleを入力してください（空白のみは使えません）。' })
  if (!input.body.trim()) errors.push({ name: 'body', message: 'Bodyを入力してください（空白のみは使えません）。' })
  if (!input.types.length) errors.push({ name: 'types', message: 'Typeを1件以上選択してください。' })
  return errors
}

async function saveEntry() {
  if (isSaving.value || validateEntry(state).length) return
  isSaving.value = true
  saveError.value = ''
  try {
    await $fetch(`/api${projectPath.value}/entries`, {
      method: 'POST',
      retry: 0,
      body: { title: state.title.trim(), body: state.body.trim(), types: [...state.types] }
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
        <UFormField
          label="Title"
          name="title"
          required
        >
          <UInput
            v-model="state.title"
            class="w-full"
            autofocus
          />
        </UFormField>
        <UFormField
          label="Body"
          name="body"
          required
        >
          <UTextarea
            v-model="state.body"
            class="w-full"
            :rows="8"
          />
        </UFormField>
        <UFormField
          label="Type"
          name="types"
          required
          description="Noteは他の4種類に分類しにくい汎用メモです。"
        >
          <UCheckboxGroup
            v-model="state.types"
            :items="typeItems"
          />
        </UFormField>
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
