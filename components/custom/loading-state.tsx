import { motion } from "framer-motion";

export const LoadingState = () => {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-background/90 backdrop-blur-[2px]">
      <motion.div 
        className="flex flex-col items-center gap-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        {/* Minimal loading spinner */}
        <div className="relative size-8">
          <motion.div
            className="absolute inset-0"
            initial={{ rotate: 0 }}
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          >
            <motion.div 
              className="size-2 bg-primary rounded-full"
              style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)' }}
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}
            />
          </motion.div>
          <motion.div
            className="absolute inset-0"
            initial={{ rotate: 120 }}
            animate={{ rotate: 480 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          >
            <motion.div 
              className="size-2 bg-primary/60 rounded-full"
              style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)' }}
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 1, repeat: Infinity, ease: "easeInOut", delay: 0.33 }}
            />
          </motion.div>
          <motion.div
            className="absolute inset-0"
            initial={{ rotate: 240 }}
            animate={{ rotate: 600 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          >
            <motion.div 
              className="size-2 bg-primary/30 rounded-full"
              style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)' }}
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 1, repeat: Infinity, ease: "easeInOut", delay: 0.66 }}
            />
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}; 