import { Link } from 'expo-router'
import React, { useState } from 'react'
import { Text, TouchableOpacity, View } from 'react-native'
import FontAwesome from 'react-native-vector-icons/FontAwesome'
import Sidebar from './Sidebar'

const Topbar = () => {

  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <View className="w-full p-5 bg-[#2e435a] flex-row justify-between">
      <View className="flex-row items-center gap-7">
        <TouchableOpacity onPress={() => setSidebarOpen(true)}>
      <FontAwesome 
        name="bars" 
        size={20} 
        color={"white"} 
      />
      </TouchableOpacity>
      <Text className="text-white text-lg font-bold">Messanger</Text>
      </View>
      <Link href="/SearchPage">
        <FontAwesome 
          name="search" 
          size={20} 
          color={"white"} 
        />
      </Link>

      {sidebarOpen && <Sidebar />}
    </View>
  )
}

export default Topbar