package models

import (
	"time"

	"gorm.io/gorm"
)

// 消息类型常量
const (
	MessageTypeText  = 1 // 文本消息
	MessageTypeImage = 2 // 图片消息
	MessageTypeVoice = 3 // 语音消息（预留）
	MessageTypeVideo = 4 // 视频消息（预留）
)

// 会话类型常量
const (
	ConversationTypePrivate = 1 // 单聊
	ConversationTypeGroup   = 2 // 群聊
)

// User 用户模型
type User struct {
	ID        int64          `json:"id" gorm:"primaryKey;autoIncrement"`
	Phone     string         `json:"phone" gorm:"uniqueIndex;size:20;not null"`
	PasswordHash string      `json:"-" gorm:"size:255;not null"`
	Nickname  string         `json:"nickname" gorm:"size:50;not null"`
	Avatar    string         `json:"avatar" gorm:"size:255;default:'default.png'"`
	Gender    int            `json:"gender" gorm:"default:0"`           // 0-未设置 1-男 2-女
	Signature string         `json:"signature" gorm:"size:200;default:''"`  // 个性签名

	// 关联字段（不序列化）
	Friends          []FriendRelation `json:"-" gorm:"foreignKey:UserID"`
	FriendsWith      []FriendRelation `json:"-" gorm:"foreignKey:FriendID"`

	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `json:"-" gorm:"index"`
}

// FriendRelation 好友关系模型
type FriendRelation struct {
	ID       int64     `json:"id" gorm:"primaryKey;autoIncrement"`
	UserID   int64     `json:"user_id" gorm:"not null"`
	FriendID int64     `json:"friend_id" gorm:"not null"`
	CreatedAt time.Time `json:"created_at"`

	// 关联
	User   User `json:"-" gorm:"foreignKey:UserID"`
	Friend User `json:"-" gorm:"foreignKey:FriendID"`
}

// Group 群组模型
type Group struct {
	ID         int64  `json:"id" gorm:"primaryKey;autoIncrement"`
	Name       string `json:"name" gorm:"size:50;not null"`
	OwnerID    int64  `json:"owner_id" gorm:"not null"`
	MemberCount int   `json:"member_count" gorm:"default:0"`

	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `json:"-" gorm:"index"`

	// 关联
	Owner   User            `json:"-" gorm:"foreignKey:OwnerID"`
	Members []GroupMember   `json:"-" gorm:"foreignKey:GroupID"`
}

// GroupMember 群成员模型
type GroupMember struct {
	ID       int64     `json:"id" gorm:"primaryKey;autoIncrement"`
	GroupID  int64     `json:"group_id" gorm:"not null"`
	UserID   int64     `json:"user_id" gorm:"not null"`
	JoinedAt time.Time `json:"joined_at" gorm:"autoCreateTime"`

	// 关联
	Group Group `json:"-" gorm:"foreignKey:GroupID"`
	User  User  `json:"-" gorm:"foreignKey:UserID"`
}

// Message 消息模型
type Message struct {
	ID         int64  `json:"id" gorm:"primaryKey;autoIncrement"`
	FromUserID int64  `json:"from_user_id" gorm:"not null"`
	ToUserID   *int64 `json:"to_user_id" gorm:"default:null"`   // 单聊接收者
	GroupID    *int64 `json:"group_id" gorm:"default:null"`     // 群聊ID
	Content    string `json:"content" gorm:"type:text;not null"`
	MsgType    int    `json:"msg_type" gorm:"default:1"`        // 1-文本

	CreatedAt time.Time `json:"created_at"`

	// 关联
	FromUser User `json:"-" gorm:"foreignKey:FromUserID"`
	ToUser   *User `json:"-" gorm:"foreignKey:ToUserID"`
	Group    *Group `json:"-" gorm:"foreignKey:GroupID"`
}

// Conversation 会话模型
type Conversation struct {
	ID          int64  `json:"id" gorm:"primaryKey;autoIncrement"`
	UserID      int64  `json:"user_id" gorm:"not null"`
	Type        int    `json:"type" gorm:"not null"`        // 1-单聊 2-群聊
	TargetID    int64  `json:"target_id" gorm:"not null"`   // 好友ID或群组ID
	LastMsgID   *int64 `json:"last_msg_id" gorm:"default:null"` // 最后一条消息ID
	UnreadCount int    `json:"unread_count" gorm:"default:0"`

	UpdatedAt time.Time `json:"updated_at"`

	// 关联
	User    User    `json:"-" gorm:"foreignKey:UserID"`
	LastMsg *Message `json:"-" gorm:"foreignKey:LastMsgID"`
}

// FileStorage 文件存储模型 - 存储唯一文件
type FileStorage struct {
	ID          int64  `json:"id" gorm:"primaryKey;autoIncrement"`
	Hash        string `json:"hash" gorm:"uniqueIndex:idx_hash;size:64;not null"` // SHA256哈希
	FileName    string `json:"file_name" gorm:"size:255"`                          // 原始文件名
	FileSize    int64  `json:"file_size" gorm:"not null"`                          // 文件大小(字节)
	MimeType    string `json:"mime_type" gorm:"size:100"`                          // MIME类型
	StoragePath string `json:"storage_path" gorm:"size:512;not null"`              // 相对存储路径
	RefCount    int    `json:"ref_count" gorm:"default:1;not null"`                // 引用计数

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// FileReference 文件引用模型 - 记录文件使用关系
type FileReference struct {
	ID      int64  `json:"id" gorm:"primaryKey;autoIncrement"`
	FileID  int64  `json:"file_id" gorm:"index:idx_file_id;not null"`  // 关联file_storage.id
	UserID  int64  `json:"user_id" gorm:"index:idx_user_id;not null"`  // 哪个用户使用
	RefType string `json:"ref_type" gorm:"index:idx_ref_type;size:20"` // avatar/chat_image
	RefID   int64  `json:"ref_id" gorm:"index:idx_ref_id"`              // 业务ID（消息ID等）

	CreatedAt time.Time      `json:"created_at"`
	DeletedAt gorm.DeletedAt `json:"-" gorm:"index"` // 软删除

	// 关联
	File FileStorage `json:"-" gorm:"foreignKey:FileID"`
	User User        `json:"-" gorm:"foreignKey:UserID"`
}

// TableName 指定表名
func (User) TableName() string           { return "users" }
func (FriendRelation) TableName() string { return "friend_relations" }
func (Group) TableName() string          { return "groups" }
func (GroupMember) TableName() string    { return "group_members" }
func (Message) TableName() string        { return "messages" }
func (Conversation) TableName() string   { return "conversations" }
func (FileStorage) TableName() string    { return "file_storage" }
func (FileReference) TableName() string  { return "file_references" }
