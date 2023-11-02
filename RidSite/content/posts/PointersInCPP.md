+++ 
draft = "true"
date = 2023-10-06T12:20:22+06:00
title = "Pointers in C/C++"
authors = [ "Ridhwan" ]
tags = [ "C++ Lines" ]
categories = [ "Programming" ]
+++

# Pointers in C/C++

Before starting I wanna clarify that, I always wanted to share my knowledge of C++, there are some things in C++
that beginners find hard to catch as it is different from other languages. <br>

C++ is a VERY powerful, the fastest programming language to ever exist till now.
(To a lot of people it is the hardest language to learn due to it's complexity). So naturally C++ will have some special stuff.
Today I will talk about `Pointers` in C++, what are they and why they exist.


# Pointers

```cpp
#include <iostream>

int main()
{
    int myVariable = 69;
    std::cout << myVariable;  //Outputs 69
    std::cout << &myVariable; //Outputs a weird value
    return 0;
}
```

In this code I got a variable named `myVariable`, which stores value `69`
Now think of it in this way, this value `69` is stored somewhere in the RAM, it needs an actual memory of 4 bytes to store
it in the computer. I haven't discussed pointers yet, hold on. So we are clear that it needs a memory to store into.<br>
In the third line there is `std::cout << &myVariable;` with `&`. The outputted garbage value is the memory adderess. That
garbage value you see is the "MEMORY ADDRESS" of the `myVariable`. Every location of memory in the RAM has an address.
That is the address you see in the console. In my case address is `0x6dfed4`

## But what is a pointer??
Ok wait wait, sorry, I haven't discussed pointers yet. Now I will.<br>

**A pointer is a variable which can hold the memory address**<br>
I will throw an example at your face:

```cpp
#include <iostream>

int main()
{
    int myVariable = 69;
    std::cout << myVariable;  //Outputs 69
    std::cout << &myVariable; //Outputs 0x6dfed4
    int* myVariablePtr = &myVariable;
    return 0;
}
```

Here, `myVariablePtr` holds the value `0x6dfed4`. That's it. A pointer is a variable which holds the memory location.
Note that `0x6dfed4` is never a constant value, the program OS can set it to anything, to any location in RAM. It will be
different in each program execution.

- So how pointer is useful in C++? That is beyond scope of this post.

Gist is, pointer is a variable which can hold a memory address.
<br>
<br>
<br>

Thank you for reading this post, you are a NERD, just like me. 💙💙
<br>

[![HitCount](https://hits.dwyl.com/FahimFuad/006z.svg?style=flat-square&show=unique)](http://hits.dwyl.com/FahimFuad/006z)
