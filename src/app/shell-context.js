import { createContext, useContext } from "react";
// What every screen can ask the shell to do: go somewhere, open the add-task sheet, search, ask, show help, run the timer.
export const ShellCtx = createContext(null);
export const useShell = () => useContext(ShellCtx);
