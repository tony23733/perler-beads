<script setup lang="ts">
import { PALETTES } from './data/palettes'

const palettes = [PALETTES.mard, PALETTES.mard291]
</script>

<template>
  <main class="mx-auto max-w-3xl p-6 text-slate-800">
    <header>
      <h1 class="text-2xl font-bold">拼豆图纸生成器</h1>
      <p class="mt-1 text-sm text-slate-500">第一阶段 · 纯本地 · 无服务器 · 图片不外传</p>
    </header>

    <section class="mt-8 space-y-6">
      <article
        v-for="p in palettes"
        :key="p.id"
        class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
      >
        <div class="flex items-baseline justify-between">
          <h2 class="font-semibold">{{ p.nameZh }}</h2>
          <span class="text-sm text-slate-500">{{ p.colorCount }} 色</span>
        </div>

        <div v-for="g in p.groupOrder" :key="g" class="mt-3">
          <div class="text-xs text-slate-400">{{ g }} · {{ p.groupNames[g] }}</div>
          <div class="mt-1 flex flex-wrap gap-0.5">
            <span
              v-for="c in p.colors.filter((x) => x.group === g)"
              :key="c.id"
              :title="`${c.id} ${c.hex}`"
              class="h-4 w-4 rounded-sm ring-1 ring-black/10"
              :style="{ backgroundColor: c.hex }"
            />
          </div>
        </div>
      </article>
    </section>

    <footer class="mt-10 text-xs text-slate-400">
      色卡数据来源：HansBug/pindou-color-data（MIT）。色值为屏幕参考值，请以实物色卡为准。
    </footer>
  </main>
</template>
