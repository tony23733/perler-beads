<script setup lang="ts">
import { computed } from 'vue'
import type { MatchStats } from '../core/matcher'
import type { Palette } from '../types'

const props = defineProps<{
  stats: MatchStats[]
  palette: Palette
}>()

const colorMap = computed(() => new Map(props.palette.colors.map((c) => [c.id, c])))
const total = computed(() => props.stats.reduce((sum, s) => sum + s.count, 0))
</script>

<template>
  <div>
    <div class="mb-2 flex items-baseline justify-between">
      <h3 class="text-sm font-semibold text-slate-700">用色清单</h3>
      <span class="text-xs text-slate-400">
        {{ stats.length }} 色 · 共 {{ total }} 颗
      </span>
    </div>
    <ul class="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
      <li
        v-for="s in stats"
        :key="s.id"
        class="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1.5"
      >
        <span
          class="h-5 w-5 shrink-0 rounded ring-1 ring-black/10"
          :style="{ backgroundColor: colorMap.get(s.id)?.hex ?? '#000' }"
        />
        <span class="font-mono text-xs text-slate-700">{{ s.id }}</span>
        <span class="ml-auto text-xs text-slate-500">{{ s.count }}</span>
      </li>
    </ul>
  </div>
</template>
