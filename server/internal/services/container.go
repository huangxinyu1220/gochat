package services

import (
	"gorm.io/gorm"

	"gochat/internal/config"
	"gochat/internal/database"
)

// ServiceContainer 服务容器，用于管理所有服务的依赖注入
type ServiceContainer struct {
	db  *gorm.DB
	cfg *config.Config

	// 服务实例
	messageService      MessageServiceInterface
	conversationService ConversationServiceInterface
	friendService       FriendServiceInterface
	groupService        GroupServiceInterface
	userService         UserServiceInterface
}

// NewServiceContainer 创建服务容器
func NewServiceContainer() *ServiceContainer {
	db := database.GetDB()
	// 加载配置
	cfg, err := config.Init(config.GetConfigPath())
	if err != nil {
		// 如果配置加载失败，使用nil配置（服务将使用默认值）
		cfg = nil
	}

	container := &ServiceContainer{
		db:  db,
		cfg: cfg,
	}

	// 初始化所有服务（依赖注入）
	container.initializeServices()

	return container
}

// NewServiceContainerWithDB 创建服务容器（用于测试，可注入mock数据库）
func NewServiceContainerWithDB(db *gorm.DB) *ServiceContainer {
	container := &ServiceContainer{
		db: db,
	}

	container.initializeServices()

	return container
}

// 初始化所有服务
func (c *ServiceContainer) initializeServices() {
	c.messageService = NewMessageServiceWithDB(c.db)
	c.conversationService = NewConversationServiceWithDB(c.db)
	c.friendService = NewFriendServiceWithDB(c.db)
	c.groupService = NewGroupServiceWithDB(c.db)
	c.userService = NewUserServiceWithDB(c.db, c.cfg)
}

// 获取服务方法
func (c *ServiceContainer) MessageService() MessageServiceInterface {
	return c.messageService
}

func (c *ServiceContainer) ConversationService() ConversationServiceInterface {
	return c.conversationService
}

func (c *ServiceContainer) FriendService() FriendServiceInterface {
	return c.friendService
}

func (c *ServiceContainer) GroupService() GroupServiceInterface {
	return c.groupService
}

func (c *ServiceContainer) UserService() UserServiceInterface {
	return c.userService
}

// 全局服务容器实例
var globalContainer *ServiceContainer

// InitializeServices 初始化全局服务容器
func InitializeServices() {
	globalContainer = NewServiceContainer()
}

// GetContainer 获取全局服务容器
func GetContainer() *ServiceContainer {
	if globalContainer == nil {
		InitializeServices()
	}
	return globalContainer
}

// 便捷方法：直接获取服务实例
func GetMessageService() MessageServiceInterface {
	return GetContainer().MessageService()
}

func GetConversationService() ConversationServiceInterface {
	return GetContainer().ConversationService()
}

func GetFriendService() FriendServiceInterface {
	return GetContainer().FriendService()
}

func GetGroupService() GroupServiceInterface {
	return GetContainer().GroupService()
}

func GetUserService() UserServiceInterface {
	return GetContainer().UserService()
}