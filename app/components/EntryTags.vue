<script setup lang="ts">
defineProps<{ tags?: string[] }>()
</script>

<template>
  <div
    v-if="tags?.length"
    aria-label="Tag一覧"
    class="mt-2 flex flex-wrap gap-2"
  >
    <UBadge
      v-for="tag in tags"
      :key="tag"
      color="neutral"
      variant="outline"
      class="max-w-full whitespace-normal wrap-anywhere"
    >
      {{ tag }}
    </UBadge>
  </div>
</template>
