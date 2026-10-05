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
</template>
