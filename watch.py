from telethon import TelegramClient, events
from json import dumps
from kafka import KafkaProducer
from binance.client import Client

api_key = 'vKniT8QVXV1GIM92TWfJXwES9OitDhVeE4ZnjrzzvOqO968b2DV5BopUsaDBjiQF'
api_secret = 'VeKi0yKlghnsRt44m5mTbkxQb6uXVWdY7q1GAvfCXZUDqFoAuHcCRHr7COtWuVc6'


client = Client(api_key, api_secret)

bot = TelegramClient('hello_world', 3557476, '29bac16bdefb97f587655529c6ed50e2').start(bot_token='1639517771:AAHCSt5VkSRoqxB981HbcSKaQ2AXdxYCn_E')
producer = KafkaProducer(bootstrap_servers=['localhost:9092'],
                         value_serializer=lambda x: 
                         dumps(x).encode('utf-8'))
                

order_history = {}
error = []

@bot.on(events.NewMessage)
async def echo_all(event):
    try:
        if 'Trade completed.' in event.message.message:
            message = event.message.message
            id = message.split('ID: ')[1].split()[0]
            pair = message.split('Pair: ')[1].split()[0]
            order_side = message.split('Action: ')[1].split()[0]
            price = message.split('Price: ')[1].split()[0]
            balance = message.split('Balance: ')[1].split()[0]
            print (balance)
            if not('-1' in id and order_side == 'sell'):
                new_token_order = {'id': id, 'pair': pair, 'side': order_side, 'price': price, 'balance': balance}
                producer.send('ORDER', value=new_token_order)
                order = client.create_test_order(symbol=pair.replace("/", ""), side=order_side.upper(), type='MARKET', quantity=100)
    except Exception as ex:
        print ("Error: ", ex)



if __name__ == '__main__':
    bot.run_until_disconnected()