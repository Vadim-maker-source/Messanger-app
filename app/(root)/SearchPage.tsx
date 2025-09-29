import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { TextInput, TouchableOpacity, View } from 'react-native';
import FontAwesome from 'react-native-vector-icons/FontAwesome';

const SearchPage = () => {
  const router = useRouter();

  const [searchValue, setSearchValue] = useState("")

  const handleGoBack = () => {
    router.back();
  };

  const handleClearSearch = () => {
    setSearchValue("")
  };

  return (
    <View>
    <View className="w-full py-3 px-5 bg-[#2e435a] flex-row items-center gap-7">
      <TouchableOpacity onPress={handleGoBack}>
        <FontAwesome 
          name="arrow-left" 
          size={20} 
          color={"white"} 
        />
      </TouchableOpacity>
      <View className="flex-row items-center w-[83%]">
        <TextInput placeholder="Поиск" className="w-full text-gray-300 text-lg font-medium placeholder:text-gray-300" onChangeText={setSearchValue} value={searchValue}></TextInput>
        {searchValue != "" && (
          <TouchableOpacity onPress={handleClearSearch}>
        <FontAwesome
          name="close"
          size={20}
          color={"white"}
        />
        </TouchableOpacity>
        )}
      </View>
    </View>
    
    </View>
  );
};

export default SearchPage;