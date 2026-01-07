import { ReactNode } from "react";

export type Sender = "user" | "assistant";

type Props = {
  sender: Sender;
  children: ReactNode;
};

const MessageBubble = ({ sender, children }: Props) => {
  const isUser = sender === "user";
  const base = "max-w-[80%] rounded-2xl px-4 py-3 text-sm shadow-sm";
  const userStyles = "ml-auto bg-sky-600 text-white";
  const assistantStyles =
    "mr-auto bg-white text-slate-800 dark:bg-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700";

  return (
    <div className={`${base} ${isUser ? userStyles : assistantStyles}`}>
      {children}
    </div>
  );
};

export default MessageBubble;
