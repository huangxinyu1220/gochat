import React, { useState, useEffect } from 'react';
import { Avatar, Typography, Button, List, Badge, message, Input, Modal, Tag, Card, Divider, Row, Col, App, Dropdown } from 'antd';
import { LogoutOutlined, UserOutlined, TeamOutlined, WechatOutlined, CloseOutlined, DeleteOutlined, SearchOutlined, UserAddOutlined, SmileOutlined, PictureOutlined, AudioOutlined, LoadingOutlined, PlusOutlined } from '@ant-design/icons';
import { useAuth } from '../context/AuthContext';
import { useWebSocket } from '../context/WebSocketContext'; // 新增导入
import { conversationAPI, friendAPI, userAPI, groupAPI } from '../services/api';
import ChatInterface from '../components/ChatInterface';
import ProfileEditModal from '../components/ProfileEditModal';
import EmojiPicker from '../components/EmojiPicker';
import CreateGroupModal from '../components/CreateGroupModal';
import GroupAvatar from '../components/GroupAvatar';
import GroupMembersSidebar from '../components/GroupMembersSidebar';
import GroupDetailModal from '../components/GroupDetailModal';
import { getNameInitial } from '../utils/chinesePinyin';
import { getAvatarSrc, updateAvatarCacheVersion } from '../utils/avatar';

// 企业微信风格布局的IM界面
const MainPage = () => {
  const { Text } = Typography;
  const { TextArea } = Input;

  // 添加CSS动画定义
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  // 为每个会话维护独立的输入框内容
  const [conversationInputs, setConversationInputs] = useState({});

  // 获取当前会话的输入值
  const getInputValue = (conversationId) => {
    return conversationInputs[conversationId] || '';
  };

  // 设置当前会话的输入值
  const setInputValue = (conversationId, value) => {
    setConversationInputs(prev => ({
      ...prev,
      [conversationId]: value
    }));
  };

  // 格式化性别显示
  const formatGender = (gender) => {
    switch (gender) {
      case 2:
        return '女';
      case 1:
      default:
        return '男';
    }
  };

  // 格式化最后消息时间 - 修复时区问题
  const formatLastMessageTime = (timestamp) => {
    if (!timestamp) return '';

    let date;
    if (typeof timestamp === 'string') {
      // 检查是否已经是ISO格式（包含T和Z）
      if (timestamp.includes('T') && timestamp.endsWith('Z')) {
        // 已经是ISO格式，直接使用
        date = new Date(timestamp);
      } else {
        // 后端返回的UTC时间字符串，格式如 "2025-11-03 03:45:59"
        // 强制作为UTC时间处理，转换为本地时间显示
        const utcTimestamp = timestamp.replace(' ', 'T') + 'Z';
        date = new Date(utcTimestamp);
      }
    } else if (typeof timestamp === 'number') {
      // 数字时间戳
      date = new Date(timestamp > 1000000000000 ? timestamp : timestamp * 1000);
    } else {
      date = new Date(timestamp);
    }

    // 检查日期是否有效
    if (isNaN(date.getTime())) {
      console.warn('Invalid timestamp:', timestamp);
      return '';
    }

    const now = new Date();
    const diff = now - date;

    // 使用本地时间进行日期比较
    const nowLocal = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dateLocal = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const dayDiff = Math.floor((nowLocal - dateLocal) / 86400000);

    if (diff < 60000) { // 1分钟内
      return '刚刚';
    } else if (diff < 3600000) { // 1小时内
      return `${Math.floor(diff / 60000)}分钟前`;
    } else if (dayDiff === 0) { // 今天
      // 使用转换后的本地时间显示
      const localHour = date.getHours();
      const localMinute = date.getMinutes();
      const timeStr = `${String(localHour).padStart(2, '0')}:${String(localMinute).padStart(2, '0')}`;
      return timeStr;
    } else if (dayDiff === 1) { // 昨天
      return '昨天';
    } else if (now.getFullYear() === date.getFullYear()) { // 今年
      return `${date.getMonth() + 1}-${date.getDate()}`;
    } else { // 今年以前
      return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
    }
  };

  // 格式化会话列表的最后一条消息内容
  const formatLastMessageContent = (content, msgType) => {
    if (!content) return '';

    // 如果是图片消息，显示 [图片]
    if (msgType === 2) {
      return '[图片]';
    }

    // 文本消息直接显示
    return content;
  };

  const { user, logout } = useAuth();
  const { modal } = App.useApp(); // 使用App.useApp获取modal实例
  const { registerMessageHandler, wsClient } = useWebSocket(); // 新增WebSocket hooks
  const [activeNav, setActiveNav] = useState('conversations'); // conversations | friends
  const [conversations, setConversations] = useState([]);
  const [filteredConversations, setFilteredConversations] = useState([]);
  const [friends, setFriends] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [rightPanelVisible, setRightPanelVisible] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [conversationSearchValue, setConversationSearchValue] = useState('');

  // 添加好友相关状态
  const [addFriendModalVisible, setAddFriendModalVisible] = useState(false);
  const [addFriendSearchValue, setAddFriendSearchValue] = useState('');
  const [hasSearchedFriend, setHasSearchedFriend] = useState(false);

  // 个人信息编辑相关状态
  const [profileEditModalVisible, setProfileEditModalVisible] = useState(false);

  // 创建群组相关状态
  const [createGroupModalVisible, setCreateGroupModalVisible] = useState(false);

  // 群详情相关状态
  const [groupDetailModalVisible, setGroupDetailModalVisible] = useState(false);
  const [showAddMemberInitially, setShowAddMemberInitially] = useState(false);

  // 群成员侧边栏显示状态
  const [groupMembersSidebarVisible, setGroupMembersSidebarVisible] = useState(true);

  // 群成员缓存（用于九宫格头像）
  const [groupMembersCache, setGroupMembersCache] = useState({});

  // 响应式状态 - 监听窗口宽度
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);

  // 监听窗口大小变化
  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 计算是否应该显示群成员侧边栏
  const shouldShowGroupMembersSidebar = rightPanelVisible &&
                                       selectedItem?.type === 2 &&
                                       windowWidth >= 1200 &&
                                       groupMembersSidebarVisible;

  // 群成员侧边栏关闭处理函数
  const handleGroupMembersSidebarClose = () => {
    setGroupMembersSidebarVisible(false);
  };

  // 群成员侧边栏切换处理函数
  const handleGroupMembersSidebarToggle = () => {
    setGroupMembersSidebarVisible(!groupMembersSidebarVisible);
  };

  // 图片上传相关状态
  const [uploading, setUploading] = useState(false);
  const imageInputRef = React.useRef(null);
  const chatInterfaceRef = React.useRef(null);

  // 加载数据
  useEffect(() => {
    if (activeNav === 'conversations') {
      loadConversations();
    } else if (activeNav === 'friends') {
      loadFriends();
    }
  }, [activeNav]);

  // 注册WebSocket消息处理器，用于实时更新会话列表
  useEffect(() => {
    if (!registerMessageHandler) return;

    const handleGlobalMessage = (type, data) => {
      if (type === 'message') {
        // 收到新消息时更新会话列表
        setConversations(prev => {
          const updatedConversations = prev.map(conv => {
            // 单聊消息
            if (data.group_id === undefined && conv.target_id === data.from_user_id && conv.type === 1) {
              return {
                ...conv,
                last_msg_content: data.content,
                last_msg_time: data.created_at,
                unread_count: conv.unread_count + 1,
              };
            }
            // 群聊消息
            if (data.group_id !== undefined && conv.target_id === data.group_id && conv.type === 2) {
              return {
                ...conv,
                last_msg_content: data.content,
                last_msg_time: data.created_at,
                unread_count: conv.unread_count + 1,
              };
            }
            return conv;
          });

          // 如果没有找到对应会话，创建新会话（仅单聊）
          const existingConv = prev.find(conv =>
            (data.group_id === undefined && conv.target_id === data.from_user_id && conv.type === 1) ||
            (data.group_id !== undefined && conv.target_id === data.group_id && conv.type === 2)
          );

          if (!existingConv && data.from_user && data.group_id === undefined) {
            // 创建新单聊会话
            const newConversation = {
              id: Date.now(), // 临时ID
              type: 1, // 单聊
              target_id: data.from_user_id,
              target_name: data.from_user.nickname,
              target_avatar: data.from_user.avatar,
              last_msg_content: data.content,
              last_msg_time: data.created_at,
              unread_count: 1,
            };
            return [newConversation, ...updatedConversations];
          }

          return updatedConversations;
        });

        // 同时更新过滤后的会话列表
        setFilteredConversations(prev => {
          const updatedConversations = prev.map(conv => {
            // 单聊消息
            if (data.group_id === undefined && conv.target_id === data.from_user_id && conv.type === 1) {
              return {
                ...conv,
                last_msg_content: data.content,
                last_msg_time: data.created_at,
                unread_count: conv.unread_count + 1,
              };
            }
            // 群聊消息
            if (data.group_id !== undefined && conv.target_id === data.group_id && conv.type === 2) {
              return {
                ...conv,
                last_msg_content: data.content,
                last_msg_time: data.created_at,
                unread_count: conv.unread_count + 1,
              };
            }
            return conv;
          });

          const existingConv = prev.find(conv =>
            (data.group_id === undefined && conv.target_id === data.from_user_id && conv.type === 1) ||
            (data.group_id !== undefined && conv.target_id === data.group_id && conv.type === 2)
          );

          if (!existingConv && data.from_user && data.group_id === undefined) {
            const newConversation = {
              id: Date.now(),
              type: 1,
              target_id: data.from_user_id,
              target_name: data.from_user.nickname,
              target_avatar: data.from_user.avatar,
              last_msg_content: data.content,
              last_msg_time: data.created_at,
              unread_count: 1,
            };
            return [newConversation, ...updatedConversations];
          }

          return updatedConversations;
        });
      }
    };

    // 注册消息处理器
    const unregister = registerMessageHandler(handleGlobalMessage);

    // 清理函数
    return () => {
      unregister();
    };
  }, [registerMessageHandler]);

  // 实时搜索会话 - 监听搜索值变化
  useEffect(() => {
    if (conversationSearchValue.trim()) {
      // 根据会话名称过滤 - 单聊是好友昵称，群聊是群名
      const filtered = conversations.filter(conv =>
        conv.target_name &&
        conv.target_name.toLowerCase().includes(conversationSearchValue.toLowerCase())
      );
      setFilteredConversations(filtered);
    } else {
      // 如果没有搜索词，显示所有会话
      setFilteredConversations(conversations);
    }
  }, [conversations, conversationSearchValue]);

  // 加载群成员（用于九宫格头像）
  const loadGroupMembers = async (groupId) => {
    // 如果已缓存，直接返回
    if (groupMembersCache[groupId]) {
      return groupMembersCache[groupId];
    }

    try {
      const response = await groupAPI.getGroupMembers(groupId);
      if (response.code === 0) {
        const members = response.data || [];
        setGroupMembersCache(prev => ({
          ...prev,
          [groupId]: members
        }));
        return members;
      }
    } catch (error) {
      console.error('加载群成员失败:', error);
    }
    return [];
  };

  const loadConversations = async () => {
    try {
      const response = await conversationAPI.getConversations();
      const data = Array.isArray(response.data) ? response.data : [];
      // 过滤掉null值，确保数组元素都是有效对象
      const validConversations = data.filter(item => item && typeof item === 'object');
      setConversations(validConversations);

      // 预加载群聊成员信息（用于九宫格头像）
      validConversations.forEach(conv => {
        if (conv.type === 2) { // 群聊
          loadGroupMembers(conv.target_id);
        }
      });
    } catch (error) {
      console.error('加载会话失败:', error);
      setConversations([]); // 失败时设置为空数组
    }
  };

  const loadFriends = async () => {
    try {
      const response = await friendAPI.getFriends();
      const data = Array.isArray(response.data) ? response.data : [];
      // 过滤掉null值，确保数组元素都是有效对象
      const validFriends = data.filter(item => item && typeof item === 'object');
      setFriends(validFriends);
    } catch (error) {
      console.error('加载好友失败:', error);
      setFriends([]); // 失败时设置为空数组
      message.error('加载好友失败');
    }
  };

  const handleLogout = async () => {
    await logout();
  };

  // 处理个人信息编辑成功
  const handleProfileEditSuccess = (updatedUser) => {
    setProfileEditModalVisible(false);
    // 更新全局头像缓存版本号，强制刷新所有头像
    updateAvatarCacheVersion();
    // 强制重新渲染所有头像组件
    setTimeout(() => {
      // 这个延时确保DOM更新完成后强制重新渲染
      const event = new Event('avatarUpdated');
      window.dispatchEvent(event);
    }, 100);
  };

  // 导航菜单
  const navItems = [
    {
      key: 'conversations',
      icon: <WechatOutlined style={{ fontSize: '24px' }} />,
      title: '消息',
    },
    {
      key: 'friends',
      icon: <TeamOutlined style={{ fontSize: '24px' }} />,
      title: '好友',
    },
  ];

  // 处理导航点击
  const handleNavClick = (key) => {
    setActiveNav(key);
    setSelectedItem(null);
    setRightPanelVisible(false);
  };

  // 清除指定会话的未读消息计数
  const clearUnreadCount = async (conversationId) => {
    if (!conversationId) return;

    try {
      await conversationAPI.clearUnreadCount(conversationId);
      // 更新本地状态，移除未读计数
      setConversations(prev =>
        prev.map(c =>
          c.id === conversationId ? { ...c, unread_count: 0 } : c
        )
      );
      setFilteredConversations(prev =>
        prev.map(c =>
          c.id === conversationId ? { ...c, unread_count: 0 } : c
        )
      );
    } catch (error) {
      console.error('清除未读消息失败:', error);
    }
  };

  // 处理会话选择 - 添加自动ack逻辑
  const handleConversationSelect = async (conversation) => {
    setSelectedItem(conversation);
    setRightPanelVisible(true);

    // 如果选择的是群聊，重新显示群成员侧边栏
    if (conversation.type === 2) {
      setGroupMembersSidebarVisible(true);
    }

    // 自动清除未读消息
    if (conversation.unread_count > 0) {
      await clearUnreadCount(conversation.id);
    }
  };

  // 处理好友选择
  const handleFriendSelect = (friend) => {
    setSelectedItem(friend);
    setRightPanelVisible(true);
  };

  // Modal中搜索好友
  const handleSearchFriend = async (value) => {
    if (!value.trim()) {
      setSearchResults([]);
      setHasSearchedFriend(false);
      return;
    }

    setSearching(true);
    try {
      const response = await userAPI.searchUsers(value);
      setSearchResults(response.data);
      setHasSearchedFriend(true); // 标记已经进行过搜索
    } catch (error) {
      message.error('搜索失败');
      setSearchResults([]);
      setHasSearchedFriend(true);
    } finally {
      setSearching(false);
    }
  };

  // 从Modal中添加好友
  const handleAddFriendFromModal = async (searchUser) => {
    // 检查是否是自己
    if (searchUser.id === user?.id) {
      message.info('不能添加自己为好友');
      return;
    }

    // 检查是否已经是好友
    const isFriend = friends.some(friend => friend.id === searchUser.id);
    if (isFriend) {
      message.info('对方已经是您的好友');
      return;
    }

    try {
      // 标记正在处理
      setSearchResults(prev => prev.map(item =>
        item.id === searchUser.id ? { ...item, processing: true } : item
      ));

      await friendAPI.addFriend(searchUser.id);
      message.success(`已发送好友请求给 ${searchUser.nickname}`);

      // 从搜索结果中移除
      setSearchResults(prev => prev.filter(item => item.id !== searchUser.id));

      // 重新加载好友列表
      loadFriends();
    } catch (error) {
      message.error(error.response?.data?.message || '添加好友失败');
      // 恢复处理状态
      setSearchResults(prev => prev.map(item =>
        item.id === searchUser.id ? { ...item, processing: false } : item
      ));
    }
  };

  // 处理发送消息给好友
  const handleSendMessageToFriend = async (friend) => {
    try {
      // 查找是否已存在与该好友的会话
      let existingConversation = conversations.find(conv =>
        conv.type === 1 && conv.target_id === friend.id
      );

      if (!existingConversation) {
        // 创建新的临时会话
        const newConversation = {
          id: Date.now(), // 临时ID
          type: 1, // 单聊
          target_id: friend.id,
          target_name: friend.nickname,
          target_avatar: friend.avatar,
          last_msg_content: '',
          last_msg_time: new Date().toISOString(),
          unread_count: 0,
        };

        // 添加到会话列表
        setConversations(prev => [newConversation, ...prev]);
        setFilteredConversations(prev => [newConversation, ...prev]);
        existingConversation = newConversation;
      }

      // 切换到会话页面
      setActiveNav('conversations');

      // 选择该会话并打开聊天界面
      setSelectedItem(existingConversation);
      setRightPanelVisible(true);

      message.success(`开始与 ${friend.nickname} 的对话`);
    } catch (error) {
      console.error('创建会话失败:', error);
      message.error('开始对话失败');
    }
  };

  // 删除好友
  const handleRemoveFriend = async (friend) => {
    console.log('删除好友函数被调用，好友信息:', friend);
    console.log('Modal实例:', modal);

    modal.confirm({
      title: '删除好友',
      content: `确定要删除好友 ${friend.nickname} 吗？`,
      okText: '删除',
      cancelText: '取消',
      okType: 'danger',
      onOk: async () => {
        console.log('用户确认删除');
        try {
          await friendAPI.removeFriend(friend.id);
          message.success(`已删除好友 ${friend.nickname}`);

          // 关闭详情面板
          setRightPanelVisible(false);
          setSelectedItem(null);

          // 立即清理相关的会话记录 - 在重新加载之前
          console.log('清理会话前，当前会话列表:', conversations);
          setConversations(prev => {
            const filtered = prev.filter(conv => !(conv.type === 1 && conv.target_id === friend.id));
            console.log('清理会话后:', filtered);
            return filtered;
          });
          setFilteredConversations(prev => {
            const filtered = prev.filter(conv => !(conv.type === 1 && conv.target_id === friend.id));
            return filtered;
          });

          // 重新加载好友列表
          await loadFriends();

          // 重新加载会话列表以确保与后端同步
          if (activeNav === 'conversations') {
            await loadConversations();
          }
        } catch (error) {
          console.error('删除好友失败:', error);
          message.error(error.response?.data?.message || '删除好友失败');
        }
      },
      onCancel: () => {
        console.log('用户取消删除');
      }
    });
  };

  // 处理图片选择
  const handleImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 检查文件类型
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      message.error('只支持 JPG、PNG、GIF、WebP 格式的图片');
      return;
    }

    // 检查文件大小（5MB）
    if (file.size > 5 * 1024 * 1024) {
      message.error('图片大小不能超过 5MB');
      return;
    }

    // 上传图片
    handleImageUpload(file);

    // 清空input，允许重复选择同一文件
    e.target.value = '';
  };

  // 上传图片并发送
  const handleImageUpload = async (file) => {
    if (!selectedItem || !wsClient) {
      message.error('请先选择会话');
      return;
    }

    setUploading(true);
    try {
      // 上传图片到服务器
      const response = await userAPI.uploadImage(file);
      const imageUrl = response.data.image_url;

      // 通过WebSocket发送图片消息
      const msgId = wsClient.sendChatMessage(selectedItem.target_id, imageUrl, 2, selectedItem.type); // msg_type=2表示图片，传递会话类型

      if (msgId) {
        // 不显示成功提示，图片发送是静默的
        // message.success('图片发送成功');

        // 更新会话列表（显示[图片]）
        setConversations(prev =>
          prev.map(conv =>
            conv.id === selectedItem.id
              ? {
                  ...conv,
                  last_msg_content: '[图片]',
                  last_msg_time: new Date().toISOString(),
                }
              : conv
          )
        );
        setFilteredConversations(prev =>
          prev.map(conv =>
            conv.id === selectedItem.id
              ? {
                  ...conv,
                  last_msg_content: '[图片]',
                  last_msg_time: new Date().toISOString(),
                }
              : conv
          )
        );

        // 通过 ref 触发 ChatInterface 更新
        // 这样图片会立即显示在聊天界面中
        if (chatInterfaceRef.current?.handleSendMessage) {
          chatInterfaceRef.current.handleSendMessage(imageUrl, 2);
        }
      }
    } catch (error) {
      console.error('图片上传失败:', error);
      message.error(error.response?.data?.message || '图片上传失败');
    } finally {
      setUploading(false);
    }
  };

  // 处理创建群组成功
  const handleCreateGroupSuccess = async (groupData) => {
    setCreateGroupModalVisible(false);
    message.success('创建群聊成功');

    // 刷新会话列表
    await loadConversations();

    // 自动选中新创建的群聊
    const newConversation = {
      id: groupData.id,
      type: 2, // 群聊
      target_id: groupData.id,
      target_name: groupData.name,
      target_avatar: 'default_group.png',
      last_msg_content: '暂无消息',
      last_msg_time: groupData.created_at,
      unread_count: 0,
    };
    setSelectedItem(newConversation);
    setRightPanelVisible(true);
    setGroupMembersSidebarVisible(true); // 显示群成员侧边栏
  };

  const renderMainContent = () => {
    if (activeNav === 'conversations') {
      return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          {/* 会话搜索栏 - 实时搜索 */}
          <div style={{
            padding: '8px 16px',
            borderBottom: '1px solid #e8e8e8',
            background: '#fff',
            display: 'flex',
            gap: '8px',
            alignItems: 'center'
          }}>
            <Input
              placeholder="搜索..."
              prefix={<SearchOutlined />}
              value={conversationSearchValue}
              onChange={(e) => setConversationSearchValue(e.target.value)}
              allowClear
              style={{ borderRadius: '20px', flex: 1 }}
            />
            <Dropdown
              menu={{
                items: [
                  {
                    key: 'chat',
                    label: '发起单聊',
                    icon: <WechatOutlined />,
                    onClick: () => {
                      setActiveNav('friends');
                      message.info('请从好友列表选择联系人开始聊天');
                    }
                  },
                  {
                    key: 'group',
                    label: '创建群聊',
                    icon: <TeamOutlined />,
                    onClick: () => setCreateGroupModalVisible(true)
                  }
                ]
              }}
              trigger={['click']}
            >
              <Button
                type="primary"
                shape="circle"
                icon={<PlusOutlined />}
                size="small"
              />
            </Dropdown>
          </div>

          {/* 会话列表 */}
          <div style={{ flex: 1, overflow: 'auto' }}>
            <List
              dataSource={filteredConversations}
              renderItem={(conv) => (
                <List.Item
                  style={{
                    padding: '6px 20px',
                    cursor: 'pointer',
                    background: selectedItem?.id === conv.id ? '#e6f7ff' : '#fff',
                    borderBottom: '1px solid #f0f0f0',
                    transition: 'background 0.2s',
                  }}
                  onClick={() => handleConversationSelect(conv)}
                >
                  <List.Item.Meta
                    avatar={
                      <Badge
                        count={conv.unread_count}
                        size="small"
                        offset={[-4, 4]}
                        style={{
                          lineHeight: 1
                        }}
                      >
                        {conv.type === 2 ? (
                          <GroupAvatar members={groupMembersCache[conv.target_id] || []} size={48} />
                        ) : (
                          <Avatar
                            size={48}
                            src={getAvatarSrc(conv.target_avatar)}
                            icon={<UserOutlined />}
                          >
                            {conv.target_name ? conv.target_name[0] : '?'}
                          </Avatar>
                        )}
                      </Badge>
                    }
                    title={
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        width: '100%'
                      }}>
                        <Text strong>{conv.target_name}</Text>
                        {/* 时间显示移到右上角 */}
                        <Text type="secondary" style={{ fontSize: '11px', flexShrink: 0 }}>
                          {conv.last_msg_time ? formatLastMessageTime(conv.last_msg_time) : ''}
                        </Text>
                      </div>
                    }
                    description={
                      conv.last_msg_content ? (
                        <Text
                          style={{
                            color: conv.unread_count > 0 ? '#1890ff' : '#666',
                            fontSize: '13px',
                          }}
                          ellipsis={true}
                        >
                          {formatLastMessageContent(conv.last_msg_content, conv.last_msg_type)}
                        </Text>
                      ) : null // 如果没有消息，不显示任何内容
                    }
                  />
                </List.Item>
              )}
              locale={{
                emptyText: conversationSearchValue.trim() ?
                  // 搜索时未找到结果
                  (
                    <div style={{ textAlign: 'center', padding: '60px', color: '#ccc' }}>
                      <SearchOutlined style={{ fontSize: '48px', marginBottom: '16px' }} />
                      <div>没有找到匹配的内容</div>
                      <Text type="secondary" style={{ fontSize: '12px' }}>
                        尝试搜索其他关键词
                      </Text>
                    </div>
                  ) :
                  // 正常情况下没有会话
                  (
                    <div style={{ textAlign: 'center', padding: '60px', color: '#ccc' }}>
                      <WechatOutlined style={{ fontSize: '48px', marginBottom: '16px' }} />
                      <div>暂无会话</div>
                      <Text type="secondary" style={{ fontSize: '12px' }}>
                        先添加好友开始聊天
                      </Text>
                    </div>
                  )
              }}
            />
          </div>
        </div>
      );
    }

    if (activeNav === 'friends') {
      // 按首字母分组好友 - 支持中文拼音首字母
      const groupFriendsByInitial = (friendList) => {
        const groups = { '#': [] }; // # 用于其他字符

        friendList.forEach(friend => {
          // 使用新的中文拼音首字母识别函数
          const initial = getNameInitial(friend.nickname);
          if (!groups[initial]) {
            groups[initial] = [];
          }
          groups[initial].push(friend);
        });

        // 排序组别 - A-Z 在前，# 在最后
        const sortedGroups = {};
        [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ', '#'].forEach(letter => {
          if (groups[letter] && groups[letter].length > 0) {
            // 组内按名称排序，使用中文排序规则
            groups[letter].sort((a, b) => {
              const nameA = a.nickname || '';
              const nameB = b.nickname || '';
              return nameA.localeCompare(nameB, 'zh-CN', { numeric: true, sensitivity: 'base' });
            });
            sortedGroups[letter] = groups[letter];
          }
        });

        return sortedGroups;
      };

      const groupedFriends = groupFriendsByInitial(friends);
      const letters = Object.keys(groupedFriends);

      return (
        <div style={{ height: '100%', position: 'relative' }}>
          {/* 好友列表主体 - 占据整个空间 */}
          <div style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'auto'
          }}>
            {/* 添加好友卡片 - 与好友列表样式保持一致 */}
            <div
              style={{
                padding: '6px 20px',
                cursor: 'pointer',
                background: selectedItem?.type === 'add' ? '#e6f7ff' : '#fff',
                borderBottom: '1px solid #f0f0f0',
                transition: 'background 0.2s',
                display: 'flex',
                alignItems: 'center',
              }}
              onClick={() => setAddFriendModalVisible(true)}
            >
              <Avatar
                size={48}
                icon={<UserAddOutlined />}
                style={{
                  marginRight: '12px',
                  backgroundColor: '#40a9ff',
                }}
              />
              <div style={{ flex: 1 }}>
                <Text strong style={{ fontSize: '14px' }}>
                  新的朋友
                </Text>
              </div>
            </div>

            {/* 好友列表头部信息 */}
            <div style={{ padding: '12px 20px', borderBottom: '1px solid #e8e8e8', fontSize: '12px', color: '#666' }}>
              我的好友 ({friends.length})
            </div>

            {/* 好友分组列表 */}
            {letters.map(letter => (
              <div key={letter} id={`group-${letter}`}>
                {/* 组标题 */}
                <div style={{
                  padding: '8px 20px',
                  background: '#f8f9fa',
                  borderTop: '1px solid #e5e7eb',
                  fontSize: '12px', // 减小字体
                  fontWeight: '500',
                  color: '#666',
                  position: 'sticky',
                  top: '0',
                  zIndex: 1
                }}>
                  {letter} {/* 直接显示字母，不使用getGroupDisplayText */}
                </div>

                {/* 该组好友列表 */}
                <List
                  dataSource={groupedFriends[letter]}
                  renderItem={(friend) => (
                    <List.Item
                      style={{
                        padding: '6px 20px',
                        cursor: 'pointer',
                        background: selectedItem?.id === friend.id ? '#e6f7ff' : '#fff',
                        borderBottom: '1px solid #f0f0f0',
                        transition: 'background 0.2s',
                      }}
                      onClick={() => handleFriendSelect(friend)}
                    >
                      <List.Item.Meta
                        avatar={
                          <Avatar
                            size={48}
                            src={getAvatarSrc(friend.avatar)} // 使用 getAvatarSrc 函数构建完整URL
                            icon={<UserOutlined />}
                          >
                            {friend.nickname ? friend.nickname[0] : '?'}
                          </Avatar>
                        }
                        title={
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            height: '48px', // 与头像高度保持一致
                          }}>
                            <Text strong style={{ fontSize: '14px' }}>
                              {friend.nickname || '未知用户'}
                            </Text>
                          </div>
                        }
                      />
                    </List.Item>
                  )}
                />
              </div>
            ))}
          </div>

          {/* 悬浮字母索引导航 - 在好友列表内容区域右侧居中 */}
          <div style={{
            position: 'absolute',
            top: '60%', // 调整到好友列表内容区域的中部
            transform: 'translateY(-50%)', // 垂直居中偏移
            right: '12px', // 稍微内移一些
            width: '20px', // 更加紧凑
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '3px', // 最小的间距
            zIndex: 5,
          }}>
            {[...'ABCDEFGHIJKLMNOPQRSTUVWXYZ', '#'].map(letter => (
              <div
                key={letter}
                style={{
                  fontSize: '10px', // 更小的字体
                  fontWeight: '400', // 更细的字体
                  color: letters.includes(letter) ? '#666' : '#ccc',
                  cursor: letters.includes(letter) ? 'pointer' : 'default',
                  lineHeight: '12px', // 行高控制
                  transition: 'color 0.2s',
                }}
                onClick={() => {
                  if (letters.includes(letter)) {
                    const element = document.getElementById(`group-${letter}`);
                    element?.scrollIntoView({ behavior: 'smooth' });
                  }
                }}
              >
                {letter}
              </div>
            ))}
          </div>
        </div>
      );
    }

    return null;
  };

  // 右侧聊天/资料面板
  const renderRightPanel = () => {
    if (!selectedItem || !rightPanelVisible) return null;

    const isConversation = selectedItem.type !== undefined;

    // 设置动态宽度，如果是会话则占满剩余空间
    const panelWidth = '100%'; // 让它占满整个第三块区域

    return (
      <div style={{
        width: panelWidth,
        height: '100%',
        background: '#fff',
        borderLeft: '1px solid #e8e8e8',
        display: 'flex',
        flexDirection: 'column',
      }}>
        <div style={{
          height: '60px',
          borderBottom: '1px solid #e8e8e8',
          padding: '0 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{
            fontSize: '16px',
            color: '#333',
            fontWeight: '500',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {selectedItem.target_name || selectedItem.nickname || '未知'}
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {/* 群聊操作按钮 */}
            {isConversation && selectedItem.type === 2 && (
              <>
                {/* 添加成员按钮 */}
                <Button
                  type="text"
                  icon={<UserAddOutlined />}
                  onClick={() => {
                    setShowAddMemberInitially(true);
                    setGroupDetailModalVisible(true);
                  }}
                  size="small"
                  style={{ color: '#666' }}
                />

                {/* 群成员列表切换按钮 */}
                <Button
                  type={shouldShowGroupMembersSidebar ? "primary" : "text"}
                  icon={<TeamOutlined />}
                  onClick={handleGroupMembersSidebarToggle}
                  size="small"
                  style={{
                    color: shouldShowGroupMembersSidebar ? '#fff' : '#666',
                    backgroundColor: shouldShowGroupMembersSidebar ? '#1890ff' : 'transparent',
                  }}
                  title={
                    windowWidth < 1200
                      ? "屏幕较小，群成员列表已自动隐藏"
                      : (groupMembersSidebarVisible ? "隐藏群成员列表" : "显示群成员列表")
                  }
                  disabled={windowWidth < 1200}
                >
                  {groupMembersCache[selectedItem.target_id]?.length || ''}
                </Button>
              </>
            )}
            {/* 关闭按钮 */}
            <Button
              type="text"
              icon={<CloseOutlined />}
              onClick={() => setRightPanelVisible(false)}
              size="small"
              style={{ color: '#666' }}
            />
          </div>
        </div>

        {/* 使用ChatInterface组件 - 修复布局，分离消息区域和输入框 */}
        <div style={{
          flex: 1,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}>
          {isConversation ? (
            <>
              {/* 消息内容区域 - 占据剩余空间 */}
              <div style={{
                flex: 1,
                overflow: 'hidden',
              }}>
                <ChatInterface
                  ref={chatInterfaceRef}
                  conversation={selectedItem}
                  currentUser={user}
                  inputValue={getInputValue(selectedItem.id)}
                  setInputValue={(value) => setInputValue(selectedItem.id, value)}
                  onSendMessage={(content) => {
                    // 发送消息后更新会话列表
                    setConversations(prev =>
                      prev.map(conv =>
                        conv.id === selectedItem.id
                          ? {
                              ...conv,
                              last_msg_content: content,
                              last_msg_time: new Date().toISOString(),
                            }
                          : conv
                      )
                    );
                    setFilteredConversations(prev =>
                      prev.map(conv =>
                        conv.id === selectedItem.id
                          ? {
                              ...conv,
                              last_msg_content: content,
                              last_msg_time: new Date().toISOString(),
                            }
                          : conv
                      )
                    );
                  }}
                  onClearUnread={() => clearUnreadCount(selectedItem.id)}
                />
              </div>

              {/* 输入框区域 - 固定在底部，不悬浮 */}
              <div style={{
                background: '#fff',
                borderTop: '1px solid #e5e7eb',
                padding: '16px',
                flexShrink: 0, // 防止被压缩
              }}>
                {/* 隐藏的图片上传input */}
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                  style={{ display: 'none' }}
                  onChange={handleImageSelect}
                />

                {/* 简化的输入框样式 - 普通文本输入 */}
                <div style={{
                  background: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '20px',
                  padding: '8px 16px',
                  minHeight: '44px',
                  position: 'relative',
                }}>
                  {/* 第一行：功能按钮栏 */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    marginBottom: '6px',
                  }}>
                    <div style={{
                      display: 'flex',
                      gap: '16px',
                      color: '#666',
                      fontSize: '16px',
                    }}>
                      <EmojiPicker
                        onSelect={(emoji) => {
                          // 在光标位置插入表情
                          const currentValue = getInputValue(selectedItem.id);
                          setInputValue(selectedItem.id, currentValue + emoji);
                        }}
                      >
                        <SmileOutlined
                          title="表情"
                          style={{
                            cursor: 'pointer',
                            fontSize: '18px',
                            transition: 'all 0.2s',
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.color = '#1890ff'}
                          onMouseLeave={(e) => e.currentTarget.style.color = '#666'}
                        />
                      </EmojiPicker>
                      {uploading ? (
                        <LoadingOutlined title="上传中..." style={{ cursor: 'not-allowed', fontSize: '18px', color: '#999' }} />
                      ) : (
                        <PictureOutlined
                          title="图片"
                          style={{ cursor: 'pointer', fontSize: '18px', transition: 'all 0.2s' }}
                          onMouseEnter={(e) => e.currentTarget.style.color = '#1890ff'}
                          onMouseLeave={(e) => e.currentTarget.style.color = '#666'}
                          onClick={() => imageInputRef.current?.click()}
                        />
                      )}
                      <AudioOutlined title="语音" style={{ cursor: 'pointer', opacity: 0.6 }} />
                    </div>

                    {/* 右下角发送文字 - 根据输入状态改变颜色，修复点击问题 */}
                    <div
                      style={{
                        position: 'absolute',
                        bottom: '8px',
                        right: '16px',
                        color: getInputValue(selectedItem.id).trim() ? '#1890ff' : '#ccc', // 有内容时蓝色，无内容时灰色
                        fontSize: '14px',
                        fontWeight: '500',
                        cursor: getInputValue(selectedItem.id).trim() ? 'pointer' : 'not-allowed', // 有内容时可点击
                        userSelect: 'none',
                        zIndex: 10, // 确保在最上层
                        pointerEvents: getInputValue(selectedItem.id).trim() ? 'auto' : 'none', // 有内容时可点击，无内容时不可点击
                      }}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (getInputValue(selectedItem.id).trim() && chatInterfaceRef.current?.handleSendMessage) {
                          // 直接调用ChatInterface暴露的发送消息方法
                          chatInterfaceRef.current.handleSendMessage();
                        }
                      }}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                    >
                      发送(S)
                    </div>
                  </div>

                  {/* 第二行：输入区域 - 扩展到三行空白 */}
                  <TextArea
                    value={getInputValue(selectedItem.id)}
                    onChange={(e) => setInputValue(selectedItem.id, e.target.value)}
                    placeholder="输入消息..."
                    autoSize={{ minRows: 3, maxRows: 6 }} // 减少到3行空白，支持最多6行
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        // 这个逻辑会在ChatInterface中处理
                      }
                    }}
                    style={{
                      resize: 'none',
                      border: 'none',
                      padding: '0',
                      lineHeight: '1.6', // 稍微增加行高，填充视觉空白
                      fontSize: '15px',
                      background: 'transparent',
                      outline: 'none',
                      boxShadow: 'none',
                    }}
                  />
                </div>
              </div>
            </>
          ) : (
            // 好友资料面板 - 重新设计
            <div style={{
              height: '100%',
              padding: '16px',
              background: '#f8f9fa',
              overflow: 'auto',
            }}>
              <Card
                style={{
                  maxWidth: '360px',
                  margin: '0 auto',
                  borderRadius: '8px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                  border: '1px solid #e8e8e8',
                }}
                styles={{ body: { padding: '24px' } }}
              >
                {/* 头像区域 */}
                <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                  <Avatar
                    size={80}
                    src={getAvatarSrc(selectedItem.avatar)}
                    icon={<UserOutlined />}
                    style={{
                      border: '3px solid #f0f0f0',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                    }}
                  />
                  <div style={{ marginTop: '12px' }}>
                    <Text style={{ fontSize: '18px', fontWeight: '600', color: '#333' }}>
                      {selectedItem.nickname || '未知用户'}
                    </Text>
                  </div>
                </div>

                <Divider style={{ margin: '16px 0' }} />

                {/* 个人信息区域 */}
                <div style={{ marginBottom: '20px' }}>
                  <Row gutter={[12, 12]}>
                    <Col span={7}>
                      <Text type="secondary" style={{ fontSize: '13px' }}>性别</Text>
                    </Col>
                    <Col span={17}>
                      <Text style={{ fontSize: '13px' }}>
                        {formatGender(selectedItem.gender)}
                      </Text>
                    </Col>

                    <Col span={7}>
                      <Text type="secondary" style={{ fontSize: '13px' }}>手机号</Text>
                    </Col>
                    <Col span={17}>
                      <Text style={{ fontSize: '13px' }}>
                        {selectedItem.phone || '未知'}
                      </Text>
                    </Col>

                    <Col span={7}>
                      <Text type="secondary" style={{ fontSize: '13px' }}>个性签名</Text>
                    </Col>
                    <Col span={17}>
                      <Text
                        style={{
                          fontSize: '13px',
                          color: selectedItem.signature ? '#333' : '#999',
                          fontStyle: selectedItem.signature ? 'normal' : 'italic'
                        }}
                      >
                        {selectedItem.signature || '这个人很懒，什么都没留下...'}
                      </Text>
                    </Col>
                  </Row>
                </div>

                <Divider style={{ margin: '16px 0' }} />

                {/* 操作按钮区域 */}
                <div style={{ textAlign: 'center' }}>
                  <Row gutter={[8, 8]}>
                    <Col span={12}>
                      <Button
                        type="primary"
                        icon={<WechatOutlined style={{ fontSize: '14px' }} />}
                        size="middle"
                        style={{
                          width: '100%',
                          borderRadius: '6px',
                          height: '36px',
                          fontSize: '13px',
                        }}
                        onClick={() => handleSendMessageToFriend(selectedItem)}
                      >
                        发送消息
                      </Button>
                    </Col>
                    <Col span={12}>
                      <Button
                        danger
                        icon={<DeleteOutlined style={{ fontSize: '14px' }} />}
                        size="middle"
                        style={{
                          width: '100%',
                          borderRadius: '6px',
                          height: '36px',
                          fontSize: '13px',
                        }}
                        onClick={() => handleRemoveFriend(selectedItem)}
                      >
                        删除好友
                      </Button>
                    </Col>
                  </Row>
                </div>
              </Card>
            </div>
          )}
        </div>
      </div>
    );
  };

  // 渲染空面板（第三块无内容时的占位）- 根据当前导航状态显示不同内容
  const renderEmptyPanel = () => {
    if (activeNav === 'conversations') {
      return (
        <div style={{
          height: '100%',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          background: '#f5f5f5',
          flexDirection: 'column',
          color: '#ccc',
        }}>
          <WechatOutlined style={{ fontSize: '64px', marginBottom: '16px' }} />
          <Text style={{ fontSize: '16px', color: '#ccc', marginBottom: '8px' }}>
            选择一个会话开始聊天
          </Text>
          <Text style={{ fontSize: '14px', color: '#bbb' }}>
            在左侧选择现有会话或到好友列表开始新对话
          </Text>
        </div>
      );
    } else if (activeNav === 'friends') {
      return (
        <div style={{
          height: '100%',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          background: '#f5f5f5',
          flexDirection: 'column',
          color: '#ccc',
        }}>
          <TeamOutlined style={{ fontSize: '64px', marginBottom: '16px' }} />
          <Text style={{ fontSize: '16px', color: '#ccc', marginBottom: '8px' }}>
            选择好友查看详情
          </Text>
          <Text style={{ fontSize: '14px', color: '#bbb' }}>
            点击好友开始聊天或查看好友信息
          </Text>
        </div>
      );
    }

    // 默认状态（兜底）
    return (
      <div style={{
        height: '100%',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        background: '#f5f5f5',
        flexDirection: 'column',
        color: '#ccc',
      }}>
        <UserOutlined style={{ fontSize: '64px', marginBottom: '16px' }} />
        <Text style={{ fontSize: '16px', color: '#ccc' }}>
          欢迎使用即时通讯
        </Text>
      </div>
    );
  };

  return (
    <div style={{ height: '100vh', display: 'flex', position: 'relative' }}>
      {/* 第一块：垂直导航栏（紧凑版，企业微信风格） */}
      <div style={{
        width: '64px',
        background: '#f8f9fa',
        borderRight: '1px solid #e8e8e8',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* 导航图标区域 - 统一间距 */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '16px 8px',
          gap: '8px',
        }}>
          {/* 顶部用户信息 - 与其他按钮同等间距 */}
          <div
            key="user-avatar"
            style={{
              width: '48px',
              height: '48px',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            title={`${user?.nickname} - 点击编辑个人信息`}
            onClick={() => setProfileEditModalVisible(true)}
          >
            <Avatar
              size={48} // 头像占满整个容器
              src={getAvatarSrc(user?.avatar)}
              icon={<UserOutlined />}
              style={{
                width: '48px',
                height: '48px',
                border: '2px solid #e8e8e8', // 添加边框提升视觉效果
              }}
            />
          </div>

          {/* 两个导航按钮 */}
          {navItems.map(item => (
            <div
              key={item.key}
              style={{
                width: '48px',
                height: '48px',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                cursor: 'pointer',
                color: activeNav === item.key ? '#1890ff' : '#666',
                background: activeNav === item.key ? '#d9e8ff' : 'transparent',
                borderRadius: '12px',
                transition: 'background 0.2s, color 0.2s',
              }}
              onClick={() => handleNavClick(item.key)}
              title={item.title}
            >
              <div style={{
                fontSize: '20px',
              }}>
                {item.icon}
              </div>
            </div>
          ))}
        </div>

        {/* 底部设置/退出区域 - 统一按钮样式 */}
        <div style={{
          padding: '16px 8px',
        }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              cursor: 'pointer',
              color: '#666',
              background: 'transparent',
              border: '2px solid transparent',
              borderRadius: '12px',
              transition: 'all 0.2s',
            }}
            onClick={handleLogout}
            title="退出登录"
          >
            <div style={{ fontSize: '20px' }}>
              <LogoutOutlined />
            </div>
          </div>
        </div>
      </div>

      {/* 第二块：内容列表区域（优化宽度，缩短20%） */}
      <div style={{
        width: '288px', // 从360px缩短20%，节约72px空间给聊天区域
        background: '#fff',
        borderRight: '1px solid #e8e8e8',
        overflow: 'hidden',
      }}>
        {renderMainContent()}
      </div>

      {/* 第三块：聊天/资料区域（等分三份之一） */}
      <div style={{
        flex: 1,
        background: '#fff',
        overflow: 'hidden',
        marginRight: shouldShowGroupMembersSidebar ? '320px' : '0',
      }}>
        {rightPanelVisible ? renderRightPanel() : renderEmptyPanel()}

        {/* 添加好友搜索Modal */}
        <Modal
          title="添加好友"
          open={addFriendModalVisible}
          onCancel={() => {
            setAddFriendModalVisible(false);
            setAddFriendSearchValue('');
            setSearchResults([]);
            setHasSearchedFriend(false);
          }}
          footer={null}
          width={600}
          destroyOnHidden
        >
          <div style={{ padding: '16px 0' }}>
            {/* 搜索框区域 - 输入框和按钮同一行 */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{
                display: 'flex',
                gap: '12px',
                alignItems: 'center'
              }}>
                <Input
                  placeholder="输入用户名或手机号"
                  prefix={<SearchOutlined />}
                  value={addFriendSearchValue}
                  onChange={(e) => setAddFriendSearchValue(e.target.value)}
                  onPressEnter={() => handleSearchFriend(addFriendSearchValue)}
                  allowClear
                  style={{ flex: 1 }}
                />
                <Button
                  type="primary"
                  onClick={() => handleSearchFriend(addFriendSearchValue)}
                  loading={searching}
                >
                  {searching ? '搜索中...' : '搜索'}
                </Button>
              </div>
            </div>

            {/* 搜索结果显示 */}
            <div style={{
              maxHeight: '400px',
              overflowY: 'auto',
              border: '1px solid #f0f0f0',
              borderRadius: '6px',
              backgroundColor: '#fafafa'
            }}>
              <List
                dataSource={searchResults}
                renderItem={(searchUser) => {
                  // 检查是否是自己
                  const isSelf = searchUser.id === user?.id;
                  // 检查是否已经是好友
                  const isFriend = friends.some(friend => friend.id === searchUser.id);

                  return (
                    <List.Item
                      style={{
                        backgroundColor: '#fff',
                        marginBottom: '4px',
                        borderRadius: '4px',
                        padding: '12px 16px'
                      }}
                      actions={[
                        isSelf ? (
                          <Tag color="blue">自己</Tag>
                        ) : isFriend ? (
                          <Tag color="green">已是好友</Tag>
                        ) : (
                          <Button
                            type="primary"
                            size="small"
                            disabled={searchUser.processing}
                            onClick={() => handleAddFriendFromModal(searchUser)}
                            style={{
                              minWidth: '80px', // 固定最小宽度，避免宽度变化
                              width: '80px', // 固定宽度
                              height: '28px', // 固定高度
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              transition: 'all 0.2s ease', // 缩短过渡时间，更快响应
                              overflow: 'hidden', // 防止文本溢出
                              whiteSpace: 'nowrap', // 防止文本换行
                              position: 'relative' // 为loading图标定位
                            }}
                          >
                            {searchUser.processing ? (
                              <span style={{
                                fontSize: '12px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: '100%'
                              }}>
                                <span
                                  className="loading-spinner"
                                  style={{
                                    width: '12px',
                                    height: '12px',
                                    border: '2px solid #ffffff',
                                    borderTop: '2px solid transparent',
                                    borderRadius: '50%',
                                    marginRight: '4px',
                                    animation: 'spin 1s linear infinite'
                                  }}
                                />
                                处理中
                              </span>
                            ) : (
                              <span style={{
                                fontSize: '12px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: '100%'
                              }}>
                                添加好友
                              </span>
                            )}
                          </Button>
                        )
                      ]}
                    >
                      <List.Item.Meta
                        avatar={
                          <Avatar size={40} src={getAvatarSrc(searchUser.avatar)}>
                            {searchUser.nickname ? searchUser.nickname[0] : '?'}
                          </Avatar>
                        }
                        title={searchUser.nickname || '未知用户'}
                        description={searchUser.phone || '暂无手机号'}
                      />
                    </List.Item>
                  );
                }}
                locale={{
                  emptyText: !searching ? (
                    hasSearchedFriend ? (
                      <div style={{ textAlign: 'center', padding: '40px', color: '#ccc' }}>
                        <UserOutlined style={{ fontSize: '24px', marginBottom: '8px' }} />
                        <div>未找到用户</div>
                        <div style={{ fontSize: '12px' }}>请检查输入的用户名或手机号</div>
                      </div>
                    ) : (
                      <div style={{ textAlign: 'center', padding: '60px', color: '#ccc' }}>
                        <SearchOutlined style={{ fontSize: '32px', marginBottom: '12px' }} />
                        <div style={{ fontSize: '14px', marginBottom: '4px' }}>输入用户名或手机号开始搜索</div>
                        <div style={{ fontSize: '12px' }}>可添加更多的好友开始聊天</div>
                      </div>
                    )
                  ) : null
                }}
              />
            </div>
          </div>
        </Modal>

        {/* 个人信息编辑弹窗 */}
        <ProfileEditModal
          visible={profileEditModalVisible}
          onCancel={() => setProfileEditModalVisible(false)}
          onSuccess={handleProfileEditSuccess}
        />

        {/* 创建群聊弹窗 */}
        <CreateGroupModal
          visible={createGroupModalVisible}
          onCancel={() => setCreateGroupModalVisible(false)}
          onSuccess={handleCreateGroupSuccess}
        />

        {/* 群详情弹窗 */}
        {selectedItem?.type === 2 && (
          <GroupDetailModal
            visible={groupDetailModalVisible}
            groupId={selectedItem.target_id}
            onCancel={() => {
              setGroupDetailModalVisible(false);
              setShowAddMemberInitially(false);
            }}
            onUpdate={() => {
              // 刷新会话列表和群成员缓存
              loadConversations();
              loadGroupMembers(selectedItem.target_id);
            }}
            showAddMemberInitially={showAddMemberInitially}
          />
        )}
      </div>

      {/* 第四块：群成员侧边栏（仅群聊时显示） */}
      {shouldShowGroupMembersSidebar && (
        <GroupMembersSidebar
          groupId={selectedItem.target_id}
          visible={true}
          onClose={handleGroupMembersSidebarClose}
        />
      )}
    </div>
  );
};

export default MainPage;
