type ToastProps = {
  title?: string
  description?: string
  variant?: 'default' | 'destructive'
}

export function useToast() {
  return {
    toast: (props: ToastProps) => {
      // Simple implementation - you can enhance this with a proper toast library
      if (props.variant === 'destructive') {
        alert(`Error: ${props.title}\n${props.description}`)
      } else {
        alert(`${props.title}\n${props.description}`)
      }
    },
  }
}
