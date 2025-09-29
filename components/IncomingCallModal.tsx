// import { acceptCall, rejectCall } from '@/lib/api';
// import { Audio } from 'expo-av';
// import { useRouter } from 'expo-router';
// import React, { useEffect, useState } from 'react';
// import {
//   BackHandler,
//   Dimensions,
//   Image,
//   Modal,
//   Text,
//   TouchableOpacity,
//   Vibration,
//   View
// } from 'react-native';
// import FontAwesome from 'react-native-vector-icons/FontAwesome';

// const { width, height } = Dimensions.get('window');

// const IncomingCallModal: React.FC = () => {
//   const { incomingCall, hideIncomingCall, setCurrentCall, acceptCall: wsAcceptCall, rejectCall: wsRejectCall } = useCall();
//   const router = useRouter();
//   const [sound, setSound] = useState<Audio.Sound | null>(null);
//   const [isProcessing, setIsProcessing] = useState(false);

//   useEffect(() => {
//     if (incomingCall) {
//       console.log('Показываем входящий звонок от:', incomingCall.caller.name);
//       playRingtone();
//       startVibration();
      
//       const backHandler = BackHandler.addEventListener(
//         'hardwareBackPress',
//         () => {
//           if (!isProcessing) {
//             handleReject();
//           }
//           return true;
//         }
//       );

//       return () => {
//         backHandler.remove();
//         stopRingtone();
//         stopVibration();
//       };
//     }
//   }, [incomingCall]);

//   const playRingtone = async () => {
//     try {
//       if (sound) {
//         await sound.stopAsync();
//         await sound.unloadAsync();
//       }

//       const { sound: newSound } = await Audio.Sound.createAsync(
//         require('@/assets/sounds/ringtone.mp3'),
//         { shouldPlay: true, isLooping: true }
//       );
//       setSound(newSound);
//     } catch (error) {
//       console.error('Ошибка воспроизведения звонка:', error);
//     }
//   };

//   const stopRingtone = async () => {
//     if (sound) {
//       await sound.stopAsync();
//       await sound.unloadAsync();
//       setSound(null);
//     }
//   };

//   const startVibration = () => {
//     Vibration.vibrate([1000, 1000], true);
//   };

//   const stopVibration = () => {
//     Vibration.cancel();
//   };

//   const handleAccept = async () => {
//     if (!incomingCall || isProcessing) return;
    
//     setIsProcessing(true);
//     try {
//       console.log('Принимаем звонок:', incomingCall.id);
//       stopRingtone();
//       stopVibration();
      
//       // Принимаем звонок через API
//       const response = await acceptCall(incomingCall.id);
      
//       // Уведомляем звонящего через WebSocket
//       wsAcceptCall(incomingCall.id);
      
//       // Устанавливаем текущий звонок
//       setCurrentCall(response.call);
      
//       // Скрываем модальное окно
//       hideIncomingCall();
      
//       // Переходим на экран активного звонка
//       router.push({
//         pathname: '/active-call',
//         params: { 
//           call: JSON.stringify(response.call),
//           isReceiver: 'true'
//         }
//       });
//     } catch (error: any) {
//       console.error('Ошибка принятия звонка:', error);
//       hideIncomingCall();
//     } finally {
//       setIsProcessing(false);
//     }
//   };

//   const handleReject = async () => {
//     if (!incomingCall || isProcessing) return;
    
//     setIsProcessing(true);
//     try {
//       console.log('Отклоняем звонок:', incomingCall.id);
//       stopRingtone();
//       stopVibration();
      
//       // Отклоняем звонок через API
//       await rejectCall(incomingCall.id);
      
//       // Уведомляем звонящего через WebSocket
//       wsRejectCall(incomingCall.id);
      
//       hideIncomingCall();
//     } catch (error: any) {
//       console.error('Ошибка отклонения звонка:', error);
//       hideIncomingCall();
//     } finally {
//       setIsProcessing(false);
//     }
//   };

//   if (!incomingCall) {
//     return null;
//   }

//   const isVideoCall = incomingCall.callType === 'video';

//   return (
//     <Modal
//       visible={true}
//       transparent={true}
//       animationType="slide"
//       statusBarTranslucent={true}
//       onRequestClose={handleReject}
//     >
//       <View style={{ 
//         flex: 1, 
//         backgroundColor: 'rgba(0, 0, 0, 0.9)',
//         justifyContent: 'center',
//         alignItems: 'center',
//         padding: 20
//       }}>
        
//         <Text style={{ 
//           color: 'white', 
//           fontSize: 24, 
//           marginBottom: 30,
//           fontWeight: 'bold',
//           textAlign: 'center'
//         }}>
//           {isVideoCall ? 'Входящий видеозвонок' : 'Входящий звонок'}
//         </Text>

//         <View style={{
//           width: 120,
//           height: 120,
//           borderRadius: 60,
//           backgroundColor: '#3b82f6',
//           justifyContent: 'center',
//           alignItems: 'center',
//           marginBottom: 20,
//           borderWidth: 3,
//           borderColor: 'white'
//         }}>
//           {incomingCall.caller.avatar ? (
//             <Image 
//               source={{ uri: incomingCall.caller.avatar }} 
//               style={{ width: 120, height: 120, borderRadius: 60 }}
//             />
//           ) : (
//             <Text style={{ color: 'white', fontSize: 36, fontWeight: 'bold' }}>
//               {incomingCall.caller.name.charAt(0).toUpperCase()}
//             </Text>
//           )}
//         </View>

//         <Text style={{ 
//           color: 'white', 
//           fontSize: 28, 
//           fontWeight: 'bold',
//           marginBottom: 5,
//           textAlign: 'center'
//         }}>
//           {incomingCall.caller.name}
//         </Text>

//         {incomingCall.caller.number && (
//           <Text style={{ 
//             color: '#d1d5db', 
//             fontSize: 16, 
//             marginBottom: 30,
//             textAlign: 'center'
//           }}>
//             {incomingCall.caller.number}
//           </Text>
//         )}

//         <View style={{ 
//           flexDirection: 'row', 
//           alignItems: 'center',
//           marginBottom: 40
//         }}>
//           <FontAwesome 
//             name={isVideoCall ? 'video-camera' : 'phone'} 
//             size={20} 
//             color="#d1d5db" 
//           />
//           <Text style={{ 
//             color: '#d1d5db', 
//             fontSize: 16, 
//             marginLeft: 8 
//           }}>
//             {isVideoCall ? 'Видеозвонок' : 'Аудиозвонок'}
//           </Text>
//         </View>

//         <View style={{ 
//           flexDirection: 'row', 
//           justifyContent: 'space-around',
//           width: '100%',
//           maxWidth: 300
//         }}>
          
//           <View style={{ alignItems: 'center' }}>
//             <TouchableOpacity
//               onPress={handleReject}
//               disabled={isProcessing}
//               style={{
//                 backgroundColor: '#ef4444',
//                 width: 70,
//                 height: 70,
//                 borderRadius: 35,
//                 justifyContent: 'center',
//                 alignItems: 'center',
//                 marginBottom: 10
//               }}
//             >
//               <FontAwesome 
//                 name="phone" 
//                 size={30} 
//                 color="white" 
//                 style={{ transform: [{ rotate: '135deg' }] }} 
//               />
//             </TouchableOpacity>
//             <Text style={{ color: '#ef4444', fontSize: 14 }}>Отклонить</Text>
//           </View>

//           <View style={{ alignItems: 'center' }}>
//             <TouchableOpacity
//               onPress={handleAccept}
//               disabled={isProcessing}
//               style={{
//                 backgroundColor: '#10b981',
//                 width: 70,
//                 height: 70,
//                 borderRadius: 35,
//                 justifyContent: 'center',
//                 alignItems: 'center',
//                 marginBottom: 10
//               }}
//             >
//               <FontAwesome name="phone" size={30} color="white" />
//             </TouchableOpacity>
//             <Text style={{ color: '#10b981', fontSize: 14 }}>Принять</Text>
//           </View>
//         </View>
//       </View>
//     </Modal>
//   );
// };

// export default IncomingCallModal;