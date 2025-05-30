import { motion } from "framer-motion";
import Link from "next/link";

import { GlamIcon } from "./icons";

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
        <div className="flex flex-row justify-center items-center text-zinc-900 dark:text-zinc-50">
          <GlamIcon />
        </div>
        <p>
          Welcome to Glam - where <span className="text-primary font-medium">video editing becomes effortless</span>. Transform your videos 
          with <span className="text-primary font-medium">simple text commands</span>. No complex software, no steep learning curve - just 
          tell us what you want, and watch the magic happen.
        </p>
        <p>
          Whether you&apos;re creating content for social media, making marketing videos, or 
          preserving precious memories, Glam makes it simple. <span className="text-primary font-medium">Cut scenes, remove backgrounds, 
          enhance colors</span>, and more - all with natural language commands that feel like 
          chatting with a friend.
        </p>
      </div>
    </motion.div>
  );
};
