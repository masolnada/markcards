import { createContext, useContext, useState } from 'react';

interface HelpContextValue {
  open: boolean;
  toggle: () => void;
  close: () => void;
}

const HelpContext = createContext<HelpContextValue>({
  open: false,
  toggle: () => {},
  close: () => {},
});

export function HelpProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const toggle = () => setOpen((v) => !v);
  const close = () => setOpen(false);
  return <HelpContext.Provider value={{ open, toggle, close }}>{children}</HelpContext.Provider>;
}

export function useHelp() {
  return useContext(HelpContext);
}
