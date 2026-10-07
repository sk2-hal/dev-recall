<script setup lang="ts">
import { entryTypes, entryTypeLabels } from '#shared/entry-types'
import type { EntryFormState } from '../utils/entry-form'

const state = defineModel<EntryFormState>({ required: true })
const typeItems = entryTypes.map(value => ({ value, label: entryTypeLabels[value] }))
</script>

<template>
  <UFormField
    label="Title"
    name="title"
    description="判断・問題・学びの内容が分かる短いタイトルを付けます。"
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
    description="背景や理由、手順などを記録します。改行はそのまま表示されます。"
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
    description="1つ以上選択してください（複数選択可）。Noteは他の4種類に分類しにくい汎用メモです。"
  >
    <UCheckboxGroup
      v-model="state.types"
      :items="typeItems"
    />
  </UFormField>
  <UFormField
    label="Tag"
    name="tags"
    description="任意。Enterで追加し、×で削除できます。大文字・小文字は区別します。"
  >
    <UInputTags
      v-model="state.tags"
      class="w-full"
      placeholder="Tagを入力"
      add-on-blur
      :delimiter="/$^/"
      :convert-value="(value: string) => value.trim()"
    />
  </UFormField>
</template>
