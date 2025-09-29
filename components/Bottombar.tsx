import { getCurrentUser } from '@/lib/api'
import { User } from '@/lib/types'
import { Link, usePathname } from 'expo-router'
import React, { useEffect, useState } from 'react'
import { Text, TouchableOpacity, View } from 'react-native'

import FontAwesome from 'react-native-vector-icons/FontAwesome'

const Bottombar = () => {

    const [user, setUser] = useState<User | null>(null);

    const pathname = usePathname()

    useEffect(() => {
        const checkAuth = async () => {
          try {
            const currentUser = await getCurrentUser();
            
            if (currentUser) {
              setUser(currentUser);
            }
          } catch (error) {
            console.error('Ошибка проверки авторизации:', error);
          }
        };
    
        checkAuth();
      }, []);


  return (
    <View className="absolute bottom-0 w-full border-t border-t-gray-500 py-3 px-10 bg-[#344d67]">
      <View className="flex-row justify-between gap-6">
        {/* Чаты */}
        <Link href="/" asChild>
          <TouchableOpacity className="items-center flex-1 py-2">
            <FontAwesome 
              name="comments" 
              size={24} 
              color={pathname === "/" ? "#4ECDC4" : "white"} 
            />
            <Text className={`text-xs mt-1 ${pathname === "/" ? 'text-[#4ECDC4] font-semibold' : 'text-white'}`}>
              Чаты
            </Text>
          </TouchableOpacity>
        </Link>

        {/* Звонки */}
        <Link href="/zvonki" asChild>
          <TouchableOpacity className="items-center flex-1 py-2">
            <FontAwesome 
              name="phone" 
              size={24} 
              color={pathname.startsWith("/zvonki") ? "#4ECDC4" : "white"} 
            />
            <Text className={`text-xs mt-1 ${pathname.startsWith("/zvonki") ? 'text-[#4ECDC4] font-semibold' : 'text-white'}`}>
              Звонки
            </Text>
          </TouchableOpacity>
        </Link>

        <Link href="/Contacts" asChild>
          <TouchableOpacity className="items-center flex-1 py-2">
            <FontAwesome 
              name="user" 
              size={24} 
              color={pathname.startsWith("/Contacts") ? "#4ECDC4" : "white"} 
            />
            <Text className={`text-xs mt-1 ${pathname.startsWith("/Contacts") ? 'text-[#4ECDC4] font-semibold' : 'text-white'}`}>
              Профиль
            </Text>
          </TouchableOpacity>
        </Link>

        {/* Настройки */}
        <Link href="/settings" asChild>
          <TouchableOpacity className="items-center flex-1 py-2">
            <FontAwesome 
              name="cog" 
              size={24} 
              color={pathname.startsWith("/settings") ? "#4ECDC4" : "white"} 
            />
            <Text className={`text-xs mt-1 ${pathname.startsWith("/settings") ? 'text-[#4ECDC4] font-semibold' : 'text-white'}`}>
              Настройки
            </Text>
          </TouchableOpacity>
        </Link>
      </View>
    </View>
  )
}

export default Bottombar