package logger

import (
	"io"
	"os"
	"path/filepath"

	"github.com/sirupsen/logrus"
	"gopkg.in/natefinch/lumberjack.v2"
)

var Log *logrus.Logger

// Init 初始化日志系统
// logDir: 日志文件目录
// logLevel: 日志级别 (debug/info/warn/error)
// output: 输出目标 (console/file/both)
func Init(logDir string, logLevel string, output string) error {
	Log = logrus.New()

	// 配置日志文件切割
	logFile := &lumberjack.Logger{
		Filename:   filepath.Join(logDir, "gochat.log"),
		MaxSize:    100, // MB
		MaxBackups: 7,   // 保留7个旧文件
		MaxAge:     30,  // 保留30天
		Compress:   true,
	}

	// 根据配置选择输出目标
	switch output {
	case "console":
		// 仅输出到控制台
		Log.SetOutput(os.Stdout)
	case "file":
		// 仅输出到文件
		if err := os.MkdirAll(logDir, 0755); err != nil {
			return err
		}
		Log.SetOutput(logFile)
	case "both":
		// 同时输出到文件和控制台
		if err := os.MkdirAll(logDir, 0755); err != nil {
			return err
		}
		multiWriter := io.MultiWriter(os.Stdout, logFile)
		Log.SetOutput(multiWriter)
	default:
		// 默认输出到控制台
		Log.SetOutput(os.Stdout)
	}

	// 设置日志格式
	Log.SetFormatter(&logrus.TextFormatter{
		FullTimestamp:   true,
		TimestampFormat: "2006-01-02 15:04:05",
	})

	// 设置日志级别
	level, err := logrus.ParseLevel(logLevel)
	if err != nil {
		level = logrus.InfoLevel
	}
	Log.SetLevel(level)

	return nil
}

// GetLogger 获取日志实例
func GetLogger() *logrus.Logger {
	if Log == nil {
		// 如果未初始化，使用默认配置
		Log = logrus.New()
		Log.SetFormatter(&logrus.TextFormatter{
			FullTimestamp:   true,
			TimestampFormat: "2006-01-02 15:04:05",
		})
		Log.SetLevel(logrus.InfoLevel)
	}
	return Log
}
