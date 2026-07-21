"use client"

import * as React from "react"
import { Drawer as DrawerPrimitive } from "@base-ui/react/drawer"

import { cn } from "@/lib/utils"

function Drawer({ ...props }: DrawerPrimitive.Root.Props) {
  return <DrawerPrimitive.Root data-slot="drawer" swipeDirection="down" {...props} />
}

function DrawerTrigger({ ...props }: DrawerPrimitive.Trigger.Props) {
  return <DrawerPrimitive.Trigger data-slot="drawer-trigger" {...props} />
}

function DrawerPortal({ ...props }: DrawerPrimitive.Portal.Props) {
  return <DrawerPrimitive.Portal data-slot="drawer-portal" {...props} />
}

function DrawerClose({ ...props }: DrawerPrimitive.Close.Props) {
  return <DrawerPrimitive.Close data-slot="drawer-close" {...props} />
}

function DrawerBackdrop({ className, ...props }: DrawerPrimitive.Backdrop.Props) {
  return (
    <DrawerPrimitive.Backdrop
      data-slot="drawer-backdrop"
      className={cn(
        "fixed inset-0 z-40 bg-black/30 duration-150 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
        className
      )}
      {...props}
    />
  )
}

function DrawerPopup({ className, children, ...props }: DrawerPrimitive.Popup.Props) {
  return (
    <DrawerPortal>
      <DrawerBackdrop />
      <DrawerPrimitive.Popup
        data-slot="drawer-popup"
        className={cn(
          "fixed inset-x-0 bottom-0 z-40 flex max-h-[85dvh] flex-col gap-2 rounded-t-xl bg-popover pb-[env(safe-area-inset-bottom)] text-popover-foreground ring-1 ring-foreground/10 outline-none data-open:animate-in data-open:slide-in-from-bottom data-closed:animate-out data-closed:slide-out-to-bottom",
          className
        )}
        {...props}
      >
        <div className="mx-auto mt-2 h-1.5 w-10 shrink-0 rounded-full bg-muted-foreground/30" aria-hidden />
        {children}
      </DrawerPrimitive.Popup>
    </DrawerPortal>
  )
}

export { Drawer, DrawerTrigger, DrawerPortal, DrawerClose, DrawerBackdrop, DrawerPopup }
