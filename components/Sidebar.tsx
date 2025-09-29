import { removeToken } from '@/lib/auth'
import { Link } from 'expo-router'
import React from 'react'
import { Text, TouchableOpacity, View } from 'react-native'

const Sidebar = () => {
  return (
    <View className="absolute top-0 left-0 bg-[#2e435a] p-4">
      <Link href="/CreateChat">Создать чат</Link>
      <Link href="/CreateChannel">Создать канал</Link>
      <TouchableOpacity onPress={removeToken}><Text>Выйти</Text></TouchableOpacity>
    </View>
  )
}

export default Sidebar