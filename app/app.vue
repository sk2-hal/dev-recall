<script setup lang="ts">
useHead({
  meta: [
    { name: 'viewport', content: 'width=device-width, initial-scale=1' }
  ],
  link: [
    { rel: 'icon', href: '/favicon.ico' }
  ],
  htmlAttrs: {
    lang: 'ja'
  }
})

useSeoMeta({
  description: '開発で得た判断・問題・解決・学びをProjectごとに整理するDevRecall。'
})
</script>

<template>
  <UApp>
    <UHeader
      title="DevRecall"
      :toggle="false"
    >
      <template #right>
        <UColorModeButton />
      </template>
    </UHeader>

    <UMain>
      <NuxtPage />
    </UMain>
  </UApp>
</template>
