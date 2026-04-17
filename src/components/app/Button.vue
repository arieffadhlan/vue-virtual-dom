<script setup lang="ts">
import { computed, useTemplateRef, type Component } from 'vue'
import { cn } from '@/utils/cn'

defineOptions({
  name: 'Button',
  inheritAttrs: false,
})

type ButtonVariant =
  | 'disable'
  | 'default'
  | 'outline'
  | 'dangers'
  | 'primary'
  | 'success'
  | 'warning'
  | 'dangersBordered'
  | 'primaryBordered'
  | 'successBordered'
  | 'warningBordered'

type ButtonSize =
  | 'sm'
  | 'md'
  | 'lg'
  | 'xl'
  | 'iconXs'
  | 'iconSm'
  | 'iconMd'
  | 'iconLg'
  | 'iconXl'

type ButtonType = 'button' | 'submit' | 'reset'

interface ButtonProps {
  type?: ButtonType;
  size?: ButtonSize;
  text?: string;
  className?: string;
  isDisable?: boolean;
  isLoading?: boolean;
  fullWidth?: boolean;
  icon?: Component;
  variant?: ButtonVariant;
}

const props = withDefaults(defineProps<ButtonProps>(), {
  text: '',
  className: '',
  isDisable: false,
  isLoading: false,
  fullWidth: false,
  size: 'sm',
  variant: 'primary',
});

const emits = defineEmits<{
  click: [event: Event]
}>();

const buttonRef = useTemplateRef('buttonRef');
  
const variantClassMap: Record<ButtonVariant, string> = {
  disable: 'text-[#595959] bg-[#F0F1F3]',
  default: 'text-black bg-[#FFFFFF] border border-neutral-5',
  outline: 'border border-neutral-5 bg-[#FFFFFF] hover:bg-neutral-4/40 active:bg-neutral-5/50',
  dangers: 'text-white bg-[#FF0000] hover:bg-[#E80000] active:bg-[#B50000]',
  primary: 'text-white bg-[#2866C8] hover:bg-[#245DB6] active:bg-[#1C488E]',
  success: 'text-white bg-[#12B569] hover:bg-[#10A560] active:bg-[#0D814B]',
  warning: 'text-white bg-[#F79009] hover:bg-[#E18308] active:bg-[#AF6606]',
  dangersBordered: 'text-[#FF0000] bg-[#FFE6E6] [&_svg]:text-[#FF0000]',
  primaryBordered: 'text-[#2866C8] bg-[#EAF0FA] [&_svg]:text-[#2866C8]',
  successBordered: 'text-[#12B569] bg-[#E7F8F0] [&_svg]:text-[#12B569]',
  warningBordered: 'text-[#F79009] bg-[#FEF4E6] [&_svg]:text-[#F79009]',
}

const sizeClassMap: Record<ButtonSize, string> = {
  sm: 'h-[36px] text-[14px] rounded-md px-[12px] py-2',
  md: 'h-[40px] text-[14px] rounded-lg px-[14px] py-[10px]',
  lg: 'h-[46px] text-[14px] rounded-lg px-[16px] py-[10px]',
  xl: 'h-[48px] text-[16px] rounded-lg px-[18px] py-[12px]',
  iconXs: 'size-[32px] rounded-md',
  iconSm: 'size-[36px] rounded-md',
  iconMd: 'size-[40px] rounded-md',
  iconLg: 'size-[44px] rounded-lg',
  iconXl: 'size-[48px] rounded-lg',
}

const classes = computed(() => {
  return cn(
    'flex items-center justify-center gap-2 w-fit whitespace-nowrap transition-colors font-[500] cursor-pointer [&_svg]:pointer-events-none shrink-0 [&_svg]:shrink-0 ease-linear text-sm',
    'disabled:border-0 disabled:bg-grey-100 disabled:text-neutral-7 disabled:pointer-events-none disabled:[&_svg]:text-neutral-7',
    variantClassMap[props.variant], sizeClassMap[props.size], 
    props.fullWidth && 'w-full',
    props.className,
  )
})

const onClick = (event: Event): void => {
  if (
    props.isDisable || 
    props.isLoading
  ) {
    event.preventDefault()
    return
  }

  emits('click', event)
}

defineExpose({
  element: buttonRef,
})
</script>

<template>
  <button
    :type="type"
    ref="buttonRef"
    v-bind="$attrs"
    :disabled="isDisable || isLoading"
    :class="classes"
    @click="onClick"
  >
    <template v-if="isLoading">
      <span class="text-lg leading-none" aria-hidden="true">⏳</span>
    </template>
    <template v-else-if="$slots.default">
      <slot />
    </template>
    <template v-else>
      <slot name="icon"><component :is="icon" v-if="icon" /></slot>
      <span v-if="text">{{ text }}</span>
    </template>
  </button>
</template>