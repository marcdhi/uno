import { motion } from "framer-motion";
import Link from "next/link";

import { LogoGoogle, MessageIcon, VercelIcon } from "./icons";

export const Overview = () => {
  return (
    <motion.div
      key="overview"
      className="max-w-[500px] mt-20 mx-4 md:mx-0"
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ delay: 0.5 }}
    >
      <div className="border-none bg-muted/50 rounded-2xl p-6 flex flex-col gap-4 text-zinc-500 text-sm dark:text-zinc-400 dark:border-zinc-700">
        <p className="flex flex-row justify-center gap-4 items-center text-zinc-900 dark:text-zinc-50">
          <LogoGoogle />
          <span>+</span>
          <MessageIcon />
        </p>
        <p>
          Welcome to Glam - your AI-powered video editing studio. Powered by Google&apos;s 
          Gemini 1.5 models, Glam helps you edit and enhance videos with natural language 
          commands. Simply describe what you want to change, and let our AI handle the 
          technical details.
        </p>
        <p>
          Edit your videos easily with text commands. Cut scenes, remove backgrounds,
          fix colors, and more - no complex software needed. Perfect for creators,
          marketers, or anyone looking to make great videos without the hassle.
        </p>
      </div>
    </motion.div>
  );
};
